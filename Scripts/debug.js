const { parse } = require('./parser.js');

/**
 * debug.js provides command used internally to debug HTTP syntax
 * @author Louis Brauer
 */

exports.debugHTTP = (editor => {
	console.log('debugging request');
	
	const txt = parse(editor);
	console.log(txt);
});