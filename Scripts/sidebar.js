let items = [];
 
let data = {
	getChildren: (element) => {
		return items;
	},
	
	getTreeItem: (element) => {
		let item = new TreeItem(element.method, TreeItemCollapsibleState.None);
		item.descriptiveText = `${element.status} ${element.url} (${element.latency}ms)`;
		console.log("element success", element.success)
		if (element.success) {
			item.color = Color.rgb(0, 1, 0);
		} else {
			item.color = Color.rgb(1, 0, 0);
		}
		return item ;
	},
	
	addItem: item => {
		items.unshift(item);
	}, 
	
	clear: () => {
		items = [];
	}
};
  
let tree = new TreeView("request-history-sec1", {
	dataProvider: data,
});

tree.onDidChangeSelection((selection) => {
  // console.log("New selection: " + selection.map((e) => e.name));
});

tree.onDidChangeVisibility(() => {
  console.log("Visibility Changed");
});

const addCmd = (item) => {
	data.addItem(item);
	tree.reload();
}

const clearCmd = () => {
  data.clear();
  tree.reload();
};

exports.sidebarData = data;
exports.sidebarTree = tree;
exports.clearCmd = clearCmd;
exports.addCmd = addCmd;