# Workflow: Documentation Synchronization

Whenever a new language feature, crate function, or example is added:
1. Update `documentation/index.html` with the new capability and syntax guide.
2. Update `examples/README.md` adding the new example to the index table.
3. Update root `README.md` if the change affects core language positioning, CLI commands, or ecosystem architecture.
4. Verify all HTML anchors and documentation links render without broken references.
