exports.activate = function() {
  console.log('activated')
}

exports.deactivate = function() {
  console.log('deactivated')
}

const selectSyntax = (contentType => {
  if (!contentType) return 'txt';
  if (contentType.startsWith('application/json')) return 'json';
  if (contentType.startsWith('text/html')) return 'html';
  return 'txt';
})

const runHTTP = (editor => {
  console.log('runHTTP', editor, editor.document)
  if (!TextEditor.isTextEditor(editor)) return;

  editor.selectLinesContainingCursors();
  const selectedStr = editor.selectedText;
  const txt = selectedStr.trim();

  const tokens = txt.match(/^(GET|HEAD|POST|PUT|DELETE|OPTIONS|PATCH+)\s(.+)$/);
  // 0 = full matched string
  // 1 = verb
  // 2 = URL

  if (!tokens) {
    console.log("given string was not a proper HTTP request");
    return; // no match, ignore
  }
  
  tokens.forEach((e) => {
    console.log("token", e);
  })

  if (tokens.length < 2) return;

  const verb = tokens[1];
  const url = tokens[2];

  let resultHeader = "";
  let resultBody = "";
  let type = null;

  const startTime = new Date().getTime();
  
  fetch(url, {
    method: verb,
  })
    .then((response) => {
      console.log("request done")
      const endTime = new Date().getTime();
      const latency = endTime - startTime;

      const headers = response.headers;
      resultHeader = `${response.status} ${response.statusText} (latency: ${latency}ms)`;
      type = headers.get('Content-Type');

      if (type) resultHeader += `\nContent-Type: ${type}`;

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
      nova.workspace.openNewTextDocument({
        content: ex.message,
        syntax: 'txt',
      });
    });
});

nova.commands.register('runHTTP', runHTTP);
