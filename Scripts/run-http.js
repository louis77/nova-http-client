const { parse } = require('./parser.js');

// Supported events:
// - finished (request) {method, url, latency, success}
let emitter = new Emitter();

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



exports.emitter = emitter;
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

	const block = parse(editor);
	if (!block) {
		console.log("no request found");
		return
	}
	let request = block.request;
	if (!request) return; // this is not a request block

	let resultHeader = "";
	let resultBody = "";
	let type = null;

	const startTime = new Date().getTime();

	if ((request.verb === 'GET' || request.verb === 'HEAD') && request.body !== undefined) {
		nova.workspace.showErrorMessage(nova.localize("message_no_payload_allowed", "HEAD and GET requests may not have a request body."));
		return;
	}

	// Timeout
	const timeout = timeoutMillis();
	let latency = 0;
	let status;

	timeoutPromise(timeout,
		fetch(request.url, {
			method: request.verb,
			headers: request.headers,
			body: request.body,
			redirect: redirectMode(),
		}))
		.then((response) => {
			console.log("request done")
			const endTime = new Date().getTime();
			latency = endTime - startTime;
			status = response.status;

			const headers = response.headers;
			resultHeader = `${status} ${response.statusText === 'no error' ? 'OK' : response.statusText} (latency: ${latency}ms)\n`;
			type = headers.get('Content-Type');

			if (headers) resultHeader += compileHeaders(headers.entries);

			return response.text()
		})
		.then((text) => {
			console.log("text done");
			resultBody = text;
			const result = `${resultHeader}\n\n${resultBody}`;

			emitter.emit("finished", {
				"method": request.verb,
				"url": request.url,
				"latency": latency,
				"status": status,
				"success": (status && status < 400)
			})
		
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