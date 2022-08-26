let disposeTask;

// Commands
const { runHTTP } = require('./run-http');

nova.commands.register('runHTTP', runHTTP);

// Tasks
class RunHTTPTask {
  provideTasks() {
    let task = new Task("Run HTTP");
    task.setAction(Task.Run, new TaskCommandAction('runHTTP', {
      args: []
    }));
    return [task];
  }
}

disposeTask = nova.assistants.registerTaskAssistant(new RunHTTPTask(), {
  name: "Run HTTP Assistant"
});

exports.activate = function() {
  console.log('activated')
}

exports.deactivate = function() {
  disposeTask && disposeTask.dispose();
  console.log('deactivated');
}
