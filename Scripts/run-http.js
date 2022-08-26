const selectSyntax = (contentType => {
	if (!contentType) return 'txt';
	if (contentType.startsWith('application/json')) return 'json';
	if (contentType.startsWith('text/html')) return 'html';
	if (contentType.includes('xml')) return 'xml';
	return 'txt';
});


const compileHeaders = (headers => {
	const result = [];
	headers.forEach((entry, _) => result.push(`${entry[0]}: ${entry[1]}`));
	result.sort();
	return result.join('\n');
});


// splits a request block into verb, url, headers, body
const splitSegment = (text => {
	let verb = null;
	let url = null;

	let lines = text.split('\n');
	if (lines.length < 1) return;

	const firstLine = lines.shift();
	const tokens = firstLine.match(/^(GET|HEAD|POST|PUT|DELETE|OPTIONS|PATCH+)\s(.+)$/);
	// 0 = full matched string
	// 1 = verb
	// 2 = URL
  
  	if (!tokens) {
		console.log("given string was not a proper HTTP request");
		return; // no match, ignore
	}

	// verb or url is missing  
	if (tokens.length < 2) return;

	verb = tokens[1];
	url = tokens[2];

	// headers
	const headerLines = [];
	while (lines.length) {
		const headerLine = lines.shift();
		if (headerLine.length > 0) {
			headerLines.push(headerLine);
		} else {
			// blank lines means we continue with body
			break;
		}
	}

	// Convert to a headers object: 
	// {
	//   "Content-Type": "application/json",  
	// }
	const headers = headerLines
		.map(e => e.split(':').map(f => f.trim()))
		.reduce((a, v) => ({ ...a, [v[0]]: v[1] }), {});

	const body = lines.join('\n');

	return {
		verb,
		url,
		headers,
		body,
	}
});


// checks if the body consists of one line starting with < filename
// loads that file and replaces body
// otherwise just returns the body
const parseBody = (body => {
	// it looks like nova.fs is always at the root of the
	// file system  
	const filename = body.match(/^<\s*(\S+)$/);
	console.log("filename was", filename);
	// if filename is array of 
	// 0 = full match
	// 1 = the filepath
	if (filename && filename.length === 2) {
		// we got a filename
		console.log("trying to open file ", filename[1]);
		const file = nova.fs.open(filename[1], 'rb');
		const buffer = file.read();
		file.close()
		return buffer;
	}
	return body
})

const redirectMode = (() => {
	const val = nova.config.get('http.followredirect', "boolean");
	console.log("redirectMode is", val);
	if (val === null) return "follow";

	return val ? "follow" : "manuel";
})

const timeoutMillis = (() => {
	const val = nova.config.get('http.timeoutinmilliseconds', "number");
	console.log("timeout is ", val);
	if (val === null) return 0;
	return val;
})

const timeoutPromise = ((ms, promise) => {
	// Without timeout
	if (ms === 0) {
		console.log("this request will not timeout");
		return new Promise((resolve, reject) => {
			promise
				.then(value => {
					resolve(value)
				})
				.catch(reason => {
					reject(reason)
				})
		})
	};

	// With timeout
	return new Promise((resolve, reject) => {
		console.log("this request will timeout in ms", ms);
		const timer = setTimeout(() => {
			reject(new Error('TIMEOUT'))
		}, ms)

		promise
			.then(value => {
				clearTimeout(timer)
				resolve(value)
			})
			.catch(reason => {
				clearTimeout(timer)
				reject(reason)
			})
	})
});

// Extracts the current request from the cursor position
// by expanding text selection respecting
// request separator (###)
// returns the extracted text
const extractRequest = ((editor) => {

	editor.selectLinesContainingCursors();

	let txt;
	let lastSelectedRange = editor.selectedRange;

	// Expand segment
	while (true) {
		if (editor.selectedText.trim().startsWith('###')) {
			// unselect ### separator
			editor.selectedRange = new Range(editor.selectedRange.start + 4, editor.selectedRange.end);
			break;
		}

		console.log("expanding up", editor.selectedRange.start, editor.selectedRange.end);
		editor.selectUp();

		// No more lines
		if (editor.selectedRange.isEqual(lastSelectedRange)) break;
		lastSelectedRange = editor.selectedRange;
	}

	while (true) {
		if (editor.selectedText.trim().endsWith('###')) {
			// unselect ### separator
			editor.selectedRange = new Range(editor.selectedRange.start, editor.selectedRange.end - 4);
			break;
		}

		console.log("expanding down", editor.selectedRange.start, editor.selectedRange.end);
		editor.selectDown();

		// No more lines
		if (editor.selectedRange.isEqual(lastSelectedRange)) break;
		lastSelectedRange = editor.selectedRange;
	}

	const selectedStr = editor.selectedText;
	txt = selectedStr.trim();
	return txt;
});


exports.runHTTP = (editor => {
	console.log('runHTTP', editor)

	// editor could be a TextEditor or a Workspace
	// depends on how the command was called
	if (!TextEditor.isTextEditor(editor)) {
		// This is a workspace	
		// Task was started without an open document 
		if (!editor.activeTextEditor) return;
		if (editor.activeTextEditor.document.syntax === 'http') {
			editor = editor.activeTextEditor;
		} else {
			// this document is not a HTTP doc
			return;
		}
	};

	const txt = extractRequest(editor);

	let { verb, url, headers, body } = splitSegment(txt);
	console.log("headers", headers);
	console.log("body", body);

	let resultHeader = "";
	let resultBody = "";
	let type = null;

	const startTime = new Date().getTime();

	if ((verb === 'GET' || verb === 'HEAD') && body.length) {
		nova.workspace.showErrorMessage("HEAD and GET requests may not have a request body.");
		return;
	}

	let parsedBody;

	try {
		// parseBody can fail when file not found
		parsedBody = (verb !== 'GET' && verb !== 'HEAD' ? parseBody(body) : null);
	} catch (ex) {
		console.log(ex)
		nova.workspace.showErrorMessage(ex.message);
		return;
	}

	// Timeout
	const timeout = timeoutMillis();

	timeoutPromise(timeout,
		fetch(url, {
			method: verb,
			headers: headers,
			body: parsedBody,
			redirect: redirectMode(),
		}))
		.then((response) => {
			console.log("request done")
			const endTime = new Date().getTime();
			const latency = endTime - startTime;

			const headers = response.headers;
			resultHeader = `${response.status} ${response.statusText} (latency: ${latency}ms)\n`;
			type = headers.get('Content-Type');

			if (headers) resultHeader += compileHeaders(headers.entries);

			return response.text()
		})
		.then((text) => {
			console.log("text done");
			resultBody = text;
			const result = `${resultHeader}\n\n${resultBody}`;


			nova.workspace.openNewTextDocument({
				content: result,
				syntax: selectSyntax(type),
			});
		})
		.catch(ex => {
			console.log(ex);
			nova.workspace.showErrorMessage(ex.message);
		})
});