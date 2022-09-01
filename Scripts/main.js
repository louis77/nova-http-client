let disposeTask;
let sidebarTreeView;
let sidebarDataProvider;

// Commands
const { runHTTP, emitter } = require('./run-http');
const { sidebarData, sidebarTree, clearCmd, addCmd } = require('./sidebar');

nova.commands.register('runHTTP', runHTTP);

// Tasks
class RunHTTPTask {
  provideTasks() {
    let task = new Task("Run current HTTP");
    task.setAction(Task.Run, new TaskCommandAction('runHTTP', {
      args: []
    }));
    return [task];
  }
}

disposeTask = nova.assistants.registerTaskAssistant(new RunHTTPTask(), {
  name: "HTTP Client"
});

nova.commands.register("sidebar.clear", clearCmd);

exports.activate = function() {
  emitter.on("finished", (req) => {
    addCmd(req);
  })  
  
  nova.subscriptions.add(sidebarTree);
  console.log('activated')
}

exports.deactivate = function() {
  disposeTask && disposeTask.dispose();
  console.log('deactivated');
}
