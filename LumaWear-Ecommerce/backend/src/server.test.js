process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeOrderTotals,
  buildOrderFromCartItems,
  serializeOrder,
  recordOrderPlacedActivity,
  Product,
  Order,
} from './server.js';

test('computeOrderTotals returns correct totals for a subtotal', () => {
  const totals = computeOrderTotals(230);

  assert.equal(totals.subtotal, 230);
  assert.equal(totals.discount, 0);
  assert.equal(totals.shipping, 0);
  assert.equal(totals.total, 230);
});

test('buildOrderFromCartItems maps cart entries to order items and totals', () => {
  const cartItems = [
    { productId: 'p1', quantity: 2 },
    { productId: 'p2', quantity: 1 },
  ];

  const order = buildOrderFromCartItems('user-123', cartItems, [
    { id: 'p1', name: 'Trail Runner', category: 'Shoes', price: 120, salePrice: 110 },
    { id: 'p2', name: 'Everyday Tee', category: 'Apparel', price: 40 },
  ]);

  assert.equal(order.userId, 'user-123');
  assert.equal(order.items.length, 2);
  assert.equal(order.items[0].productId, 'p1');
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].unitPrice, 110);
  assert.equal(order.subtotal, 260);
  assert.equal(order.discount, 20.8);
  assert.equal(order.shipping, 0);
  assert.equal(order.total, 239.2);
});

test('buildOrderFromCartItems rejects invalid order input before persistence', () => {
  assert.throws(
    () => buildOrderFromCartItems('user-123', [{ productId: 'missing-product', quantity: 1 }], []),
    /Product 'missing-product' was not found/
  );
});

test('serializeOrder returns public order JSON without internal fields', () => {
  const source = {
    _id: 'order-1',
    userId: 'user-1',
    items: [
      {
        productId: 'p1',
        productName: 'Trail Runner',
        category: 'Shoes',
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100,
      },
    ],
    subtotal: 100,
    shipping: 0,
    discount: 0,
    total: 100,
    status: 'pending',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  const serialized = serializeOrder(source);

  assert.equal(serialized.id, 'order-1');
  assert.equal(serialized.userId, 'user-1');
  assert.equal(serialized.items[0].productId, 'p1');
  assert.equal(serialized.items[0].productName, 'Trail Runner');
  assert.equal(serialized.total, 100);
  assert.ok(!('product' in serialized.items[0]));
});

test('Product and Order models are defined for persisted ecommerce records', () => {
  assert.ok(Product);
  assert.ok(Order);
  assert.equal(typeof Product.modelName, 'string');
  assert.equal(typeof Order.modelName, 'string');
});

test('recordOrderPlacedActivity uses persisted order identity and authoritative totals', async () => {
  const calls = [];
  const order = {
    _id: 'persisted-order-id',
    userId: 'user-123',
    orderNumber: 'LW-SERVER-123',
    subtotal: 260,
    shipping: 0,
    discount: 20.8,
    total: 239.2,
  };

  await recordOrderPlacedActivity(order, { headers: { 'user-agent': 'test-agent' }, ip: '127.0.0.1' }, {
    create(activity) {
      calls.push(activity);
      return Promise.resolve(activity);
    },
  });

  assert.deepEqual(calls[0], {
    userId: 'user-123',
    type: 'order_placed',
    route: '/checkout',
    metadata: {
      orderId: 'persisted-order-id',
      orderNumber: 'LW-SERVER-123',
      subtotal: 260,
      shipping: 0,
      discount: 20.8,
      total: 239.2,
    },
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
  });
});

test('recordOrderPlacedActivity surfaces activity failures to the order route', async () => {
  await assert.rejects(
    recordOrderPlacedActivity(
      { _id: 'persisted-order-id', userId: 'user-123', orderNumber: 'LW-SERVER-123' },
      { headers: {}, ip: '' },
      { create: () => Promise.reject(new Error('activity unavailable')) }
    ),
    /activity unavailable/
  );
});
