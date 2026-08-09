const React = require("react");
module.exports = ({ href, children, ...p }) => React.createElement("a", { href, ...p }, children);
module.exports.default = module.exports;
