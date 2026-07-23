const MODULE_NAMESPACE_OVERRIDES = Object.freeze({
  tenant: Object.freeze(['/api/v2/tenants', '/api/v2/dealers', '/api/v2/stores'])
});

function moduleNamespaces(moduleName) {
  return MODULE_NAMESPACE_OVERRIDES[moduleName] || [`/api/v2/${moduleName}`];
}

function namespaceMatchesModule(namespace, moduleName) {
  return namespace === '/api/v2' || moduleNamespaces(moduleName).includes(namespace);
}

module.exports = {
  MODULE_NAMESPACE_OVERRIDES,
  moduleNamespaces,
  namespaceMatchesModule
};
