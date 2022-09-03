const HEAD_REGEX = /^(GET|HEAD|POST|PUT|DELETE|OPTIONS|PATCH+)\s(.+)$/;
const VAR_REGEX = /^@([A-Za-z0-9_]+)\s*=\s*(.*)$/;
const VARTMPL_REGEX = /{{\s*([a-zA-Z0-9_]+)\s*}}/; // JS does not support \h
const FILEBODY_REGEX = /^<\s*(\S+)$/;
const VERB_REGEX = /^(GET|HEAD|POST|PUT|DELETE|OPTIONS|PATCH+)\s(.+)$/;

// checks if the body consists of one line starting with < filename
// loads that file and replaces body
// otherwise just returns the body
function parseBody(body) {
	body = body.trim();
	if (body.length === 0) return undefined;
	
	// it looks like nova.fs is always at the root of the
	// file system  
	const filename = body.match(FILEBODY_REGEX);
	// if filename is array of 
	// 0 = full match
	// 1 = the filepath
	if (filename && filename.length === 2) {
		console.log("reading file", filename)
		// we got a filename
		console.log("trying to open file ", filename[1]);
		const file = nova.fs.open(filename[1], 'rb');
		const buffer = file.read();
		file.close()
		console.log("returning read file", buffer);
		return buffer;
	}
	return body
}


// splits a request block into verb, url, headers, body
function extractRequest(block) {
	let verb = null;
	let url = null;

	let lines = block.text.split(block.eol);
	if (lines.length < 1) return;

	while (true) {
		const line = lines.shift();
		if (line === undefined) {
			console.log("no proper request found");
			return;
		}
		
		const tokens = line.match(VERB_REGEX);
		// 0 = full matched string
		// 1 = verb
		// 2 = URL
		
		if (!tokens) {
			continue;
		}
		
		// verb or url is missing  
		if (tokens.length < 2) return;
		
		verb = tokens[1];
		url = tokens[2];
		break;
	}

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

	let body = lines.join(block.eol);
	if (body.length === 0) body = undefined;

	return {
		verb,
		url,
		headers,
		body,
	}
}

/**
 * Returns all request blocks (separated by ###) of the current editor 
 * alongside positional information
 * @param {editor} editor - the current editor 
 * @returns [{text, start, end, eol, current}]
 */
function blockify(editor) {
	const eol = editor.document.eol;
	const separator = eol + '###';
	const separatorLength = separator.length;
	const currentPosition = editor.selectedRange.start;
	const result = [];

	// Get full text
	const txt = editor.document.getTextInRange(new Range(0, editor.document.length));
	const blocks = txt.split(separator);
	
	let currentLength = 0; // excluding separators
	blocks.forEach((block, index) => {
		const start = currentLength + (separatorLength * index);
		const end = start + block.length;
		currentLength += block.length;
		result.push({
			text: block,
			start: start,
			end: end,
			eol: eol,
			current: (currentPosition >= start && currentPosition <= end),
		});
	});

	return result;
}

/**
 * Parses an array of raw blocks and extracts global and request local variables
 * Assigns blocks the global(bool) and var[{key, value}] attributes
 * @param {array} blocks - Array of blocks from the blockify()
 * @returns {array} augmented blocks array with variables property
 */
function variablify(blocks) {
	const globalVars = [];
	
	const result = blocks.map((block, blockIdx) => {
		const requestVars = [];
		const lines = block.text.split(block.eol);
		const isGlobal = lines.reduce((prev, cur) => prev && (cur.match(HEAD_REGEX)) === null, true)
		let comment = "";
		
		let lineNum = 0;
		for (const line of lines) {
			if (line.match(HEAD_REGEX)) break; // loop until request head found
			
			const variable = line.match(VAR_REGEX);
			if (variable && variable.length == 3) {
				const newVar = {key: variable[1], value: variable[2]};
				(isGlobal ? globalVars : requestVars).push(newVar);
			} else if (blockIdx > 0 && lineNum === 0){
				comment = line.trim(); // First line is comment line (### comment)
			} 
			lineNum++
		}
		
		return { ...block, 
				 global: isGlobal,
				 comment: comment,
				 vars: [...globalVars, ...requestVars] }
	});
	
	return result;
}

/**
 * Converts the text property of a block to request properties
 * @param {array} blocks - Array of blocks from variablify()
 */
function requestify(blocks) {
	return blocks.map(block => {
		return { ...block, request: extractRequest(block) }
	});
}

/**
 * Replaces template strings in a string with variables from the vars
 * @param {array} Variables as {key, value}
 * @param {str} str - String to replace 
 * @returns str
 */
function replaceTemplateVars(vars, str) {
	// Build variable map
	
	return str.replace(VARTMPL_REGEX, (match, varname) => {
		if (vars[varname] === undefined) {
			nova.workspace.showWarningMessage(`Variable "${varname}" ${nova.localize("undefined")}. ${nova.localize("request_not_substituted", "Request was sent, but variable was not substituted")}.`);
			return match;
		}
		return vars[varname]; 
	})
}

/**
 * Resolves the variables of a block and replaces template strings
 * with variable contents
 * @param {object} block
 * @returns {object} block
 */
function resolveVars(block) {
	const varmap = {};
	
	// Build varmap
	// Order is important, global vars are first in the array
	for (const variable of block.vars) {
		varmap[variable.key] = replaceTemplateVars(varmap, variable.value);
		
		console.log("var map is now")
		for (const prop in varmap) {
			console.log("-->", prop, ":", varmap[prop])
		}
	}

	if (!block.request) {
		return block;
	}
	
	// Request URL
	block.request.url = replaceTemplateVars(varmap, block.request.url);
	
	// Request Header Values
	for (const prop in block.request.headers) {
		block.request.headers[prop] = replaceTemplateVars(varmap, block.request.headers[prop]);
	}
	
	return block;
}

/**
 * Parse the request and its context based on the current editor
 * @param {editor} editor - The current editor
 * @returns {
 *    request: {},
 *    variables: {}
 * )
 */
function parse(editor) {
	let request = {};
	let variables = {};
	
	const rawBlocks = blockify(editor);
	const varBlocks = variablify(rawBlocks);
	const blocks = requestify(varBlocks); 
	
	blocks.forEach((block, index) => {
		console.log("block", index, "start", block.start, "end", block.end, 
					"current", block.current, "global", block.global,
					"var-count", block.vars.length);
		for (const variable of block.vars) {
			console.log(` @${variable.key} = ${variable.value}`)
		}
		console.log(" comment: ### ", block.comment);
		console.log(" request: ", block.request);
	})
	
	for (const block of blocks) {
		if (block.current) {
			if (block.request && block.request.body ) {
				block.request.body = parseBody(block.request.body);
			}
			return resolveVars(block);
		}
	}
}
 
exports.parse = parse;