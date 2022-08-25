exports.activate = function() {
  console.log('activated')
}

// Command

const selectSyntax = (contentType => {
  if (!contentType) return 'txt';
  if (contentType.startsWith('application/json')) return 'json';
  if (contentType.startsWith('text/html')) return 'html';
  return 'txt';
})

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
  let body = null;
  
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
  const headers = headerLines
    .map(e => e.split(':').map(f => f.trim()))
    .reduce((a, v) => ({...a, [v[0]]: v[1]}), {});
  
  // body
  body = lines.join('\n');
  
  return {
    verb,
    url,
    headers,
    body,
  }
})

const runHTTP = (editor => {
  console.log('runHTTP', editor)
  
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
  
  fetch(url, {
    method: verb,
    headers: headers,
    body: (verb !== 'GET' && verb !== 'HEAD' ? body : null),
  })
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
    });
});

nova.commands.register('runHTTP', runHTTP);

// Tasks

class RunTasks {
  provideTasks() {
    let task = new Task("Run HTTP Task");
    task.setAction(Task.Run, new TaskCommandAction('runHTTP', {
      args: []
    }));
    return [task];
  }
}

const disposeTask = nova.assistants.registerTaskAssistant(new RunTasks(), {
  name: "Run HTTP Assistant"
});

exports.deactivate = function() {
  console.log('deactivating');
  disposeTask.dispose();
}

nova.workspace.onDidChangePath(() => {
  console.log("didChangePath");
})

nova.workspace.onDidOpenTextDocument(() => {
  console.log("onDidOpenTextDocument");
})