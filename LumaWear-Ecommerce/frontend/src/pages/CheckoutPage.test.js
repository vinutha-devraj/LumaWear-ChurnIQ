import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./CheckoutPage.jsx", import.meta.url), "utf8");

test("checkout posts only product ids and quantities", () => {
  assert.match(source, /api\("\/orders"/);
  assert.match(source, /items: cartItems\.map\(\(\{ productId, quantity \}\) => \(\{ productId, quantity \}\)\)/);
  assert.doesNotMatch(source, /logActivity\(\{[\s\S]*order_placed/);
});

test("checkout uses the server order number before clearing or navigating", () => {
  const serverOrderPosition = source.indexOf("data.order?.orderNumber");
  const clearCartPosition = source.indexOf("clearCart()", serverOrderPosition);
  const navigatePosition = source.indexOf("navigate(\"/order-confirmation\"", clearCartPosition);

  assert.ok(serverOrderPosition >= 0);
  assert.ok(clearCartPosition > serverOrderPosition);
  assert.ok(navigatePosition > clearCartPosition);
  assert.match(source, /catch \(error\) \{[\s\S]*setOrderError/);
});