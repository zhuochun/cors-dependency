(function(app) {

var moduleRegex = /[a-z]{2,3}\d{4}[a-z]{0,2}/ig;

function tree(code) {
    var node = {};

    if (!app.raw[code]) {
        alert("module code [" + code + "] not found in list.");
        return { name: code };
    }

    var mod = app.raw[code];

    node.name = mod.code;
    node.children = [];

    var dep = mod.prerequisite.match( moduleRegex ) || [];

    var i = 0, len = dep.length;

    for (; i < len; i++) {
        var child = tree(dep[i]);
        child && node.children.push(child);
    }

    return node;
}

document.getElementById("submit").addEventListener("click", function() {
    var code = document.getElementById("code").value;
    var root = tree(code.toUpperCase());

    app.draw(root);
});

})(window.app || {});
