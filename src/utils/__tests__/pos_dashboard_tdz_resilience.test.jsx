import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

describe('POSDashboard TDZ & Binding Order Resilience', () => {
    it('should have zero Temporal Dead Zone (TDZ) violations in POSDashboard', () => {
        const filePath = path.resolve(process.cwd(), 'src/pos/POSDashboard.jsx');
        const code = fs.readFileSync(filePath, 'utf8');

        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx']
        });

        let posBody = null;
        traverse(ast, {
            FunctionDeclaration(p) {
                if (p.node.id && p.node.id.name === 'POSDashboard') posBody = p.get('body');
            },
            VariableDeclarator(p) {
                if (p.node.id && p.node.id.name === 'POSDashboard') posBody = p.get('init.body');
            }
        });

        expect(posBody).not.toBeNull();

        const violations = [];
        const statements = posBody.node.body;
        statements.forEach((stmt, idx) => {
            const stmtPath = posBody.get('body')[idx];
            stmtPath.traverse({
                Function(innerPath) {
                    innerPath.skip();
                },
                Identifier(idPath) {
                    const name = idPath.node.name;
                    if (idPath.parentPath.isVariableDeclarator() && idPath.parentPath.node.id === idPath.node) return;
                    if (idPath.parentPath.isMemberExpression() && idPath.parentPath.node.property === idPath.node && !idPath.parentPath.node.computed) return;
                    if (idPath.parentPath.isObjectProperty() && idPath.parentPath.node.key === idPath.node && !idPath.parentPath.node.computed) return;

                    const binding = posBody.scope.getBinding(name);
                    if (binding && binding.scope === posBody.scope) {
                        const declLine = binding.identifier.loc.start.line;
                        const refLine = idPath.node.loc.start.line;
                        if (refLine < declLine) {
                            violations.push({ name, refLine, declLine });
                        }
                    }
                }
            });
        });

        expect(violations).toEqual([]);
    });

    it('should guarantee checkStaffAndBillCalls does not reference uninitialized variables in its deps', () => {
        const filePath = path.resolve(process.cwd(), 'src/pos/POSDashboard.jsx');
        const code = fs.readFileSync(filePath, 'utf8');

        // Verify checkStaffAndBillCalls has empty dependency array to prevent TDZ crash
        expect(code).toMatch(/const checkStaffAndBillCalls = useCallback\(async \(\) => {[\s\S]*?}, \[\]\);/);
        // Verify handleSelectTableRef is used
        expect(code).toContain('const handleSelectTableRef = useRef(null);');
        expect(code).toContain('handleSelectTableRef.current = handleSelectTable;');
    });
});
