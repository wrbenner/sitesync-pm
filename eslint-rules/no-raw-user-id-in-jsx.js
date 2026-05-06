/**
 * no-raw-user-id-in-jsx
 *
 * Fails the build when a value that looks like a user identifier
 * (e.g. `created_by`, `assigned_to`, `author_id`, `ball_in_court`, `user_id`,
 * `owner_id`, `uploaded_by`, `reviewed_by`, `approver_id`) is rendered
 * directly into JSX text without going through a known resolver wrapper
 * (`UserName`, `Avatar`, `Mention`).
 *
 * The bug class this rule prevents is the deep-dive's "code in activity"
 * finding (RFI_DEEP_DIVE_2026-05-04.md): UUID-shaped strings leaking into
 * the visible UI because a developer forgot to resolve them. The rule
 * stops regressions at lint time so the build fails fast.
 *
 * Allowed patterns:
 *   <UserName userId={rfi.created_by} />           ← resolver wrapper OK
 *   <Avatar userId={x.author_id} />                ← resolver wrapper OK
 *   <div data-user-id={x.user_id}>                 ← attribute value, not text
 *   const name = displayName(profileMap, x.user_id) ← not in JSX text
 *
 * Banned patterns:
 *   <span>{rfi.ball_in_court}</span>               ← raw render of a user ref
 *   <div>{`assigned to ${x.user_id}`}</div>        ← template literal
 *   <p>Author: {response.author_id}</p>            ← bare expression child
 */

const BANNED_NAMES = new Set([
  'user_id',
  'userId',
  'created_by',
  'createdBy',
  'assigned_to',
  'assignedTo',
  'author_id',
  'authorId',
  'ball_in_court',
  'ballInCourt',
  'owner_id',
  'ownerId',
  'uploaded_by',
  'uploadedBy',
  'reviewed_by',
  'reviewedBy',
  'approver_id',
  'approverId',
  'submitted_by',
  'submittedBy',
  'updated_by',
  'updatedBy',
  'deleted_by',
  'deletedBy',
]);

const SAFE_WRAPPER_ELEMENTS = new Set([
  'UserName',
  'Avatar',
  'Mention',
  'TestUuid',
]);

function getEndingPropertyName(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    const prop = node.property;
    if (!prop) return null;
    if (prop.type === 'Identifier') return prop.name;
    if (prop.type === 'Literal' && typeof prop.value === 'string') return prop.value;
  }
  return null;
}

function isInsideSafeWrapper(node) {
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'JSXElement') {
      const opening = parent.openingElement;
      if (opening && opening.name && opening.name.type === 'JSXIdentifier') {
        if (SAFE_WRAPPER_ELEMENTS.has(opening.name.name)) {
          return true;
        }
      }
    }
    parent = parent.parent;
  }
  return false;
}

function isJsxAttributeValue(node) {
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'JSXAttribute') return true;
    if (parent.type === 'JSXElement') return false;
    parent = parent.parent;
  }
  return false;
}

function checkExpression(context, expressionNode, reportNode) {
  if (!expressionNode) return;

  const tail = getEndingPropertyName(expressionNode);
  if (tail && BANNED_NAMES.has(tail)) {
    context.report({
      node: reportNode,
      messageId: 'rawUserIdInJsx',
      data: { name: tail },
    });
    return;
  }

  if (expressionNode.type === 'TemplateLiteral') {
    for (const expr of expressionNode.expressions) {
      const exprTail = getEndingPropertyName(expr);
      if (exprTail && BANNED_NAMES.has(exprTail)) {
        context.report({
          node: reportNode,
          messageId: 'rawUserIdInJsx',
          data: { name: exprTail },
        });
        return;
      }
    }
  }

  if (expressionNode.type === 'ConditionalExpression') {
    // `cond ? renderedTrue : renderedFalse` — both branches can render;
    // the test is a boolean and shouldn't be flagged.
    checkExpression(context, expressionNode.consequent, reportNode);
    checkExpression(context, expressionNode.alternate, reportNode);
    return;
  }

  if (expressionNode.type === 'LogicalExpression') {
    // `&&`: left is a boolean guard, right is the renderable. Only flag right.
    // `||`/`??`: either side can become the rendered value. Flag both.
    if (expressionNode.operator === '&&') {
      checkExpression(context, expressionNode.right, reportNode);
    } else {
      checkExpression(context, expressionNode.left, reportNode);
      checkExpression(context, expressionNode.right, reportNode);
    }
    return;
  }
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow rendering values whose names indicate a user identifier ' +
        '(user_id, created_by, assigned_to, ball_in_court, etc.) directly ' +
        'into JSX. Use <UserName /> or another resolver wrapper.',
    },
    messages: {
      rawUserIdInJsx:
        'Raw `{{name}}` rendered in JSX. UUIDs must not leak into the UI. ' +
        'Wrap with <UserName userId={...} /> (or <Avatar />, <Mention />) ' +
        'so the user id resolves to a name with a skeleton during load.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXExpressionContainer(node) {
        if (isJsxAttributeValue(node)) return;
        if (isInsideSafeWrapper(node)) return;
        checkExpression(context, node.expression, node);
      },
    };
  },
};

export default rule;
