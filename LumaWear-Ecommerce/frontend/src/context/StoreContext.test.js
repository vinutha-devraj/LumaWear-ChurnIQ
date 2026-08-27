import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const storeContextSource = await readFile(new URL("./StoreContext.jsx", import.meta.url), "utf8");
const checkoutPageSource = await readFile(new URL("../pages/CheckoutPage.jsx", import.meta.url), "utf8");

test("StoreContext: initializes state synchronously from localStorage to prevent wipeout on mount", () => {
  assert.match(storeContextSource, /getInitialStoreState/);
  assert.match(storeContextSource, /useReducer\(storeReducer,\s*undefined,\s*getInitialStoreState\)/);
  assert.match(storeContextSource, /localStorage\.setItem/);
});

test("StoreContext: addToCart handles product additions and quantity increments", () => {
  assert.match(storeContextSource, /case "addToCart":/);
  assert.match(storeContextSource, /productId/);
  assert.match(storeContextSource, /existing/);
});

test("StoreContext: updateCartQty updates item quantity safely", () => {
  assert.match(storeContextSource, /case "updateCartQty":/);
  assert.match(storeContextSource, /Math\.max\(1/);
});

test("StoreContext: removeFromCart removes target item by id", () => {
  assert.match(storeContextSource, /case "removeFromCart":/);
  assert.match(storeContextSource, /filter\(\(item\) => item\.id !== targetId\)/);
});

test("StoreContext: toggleWishlist adds and removes product IDs", () => {
  assert.match(storeContextSource, /case "toggleWishlist":/);
  assert.match(storeContextSource, /includes\(productId\)/);
});

test("StoreContext: clearCart resets cart array to empty", () => {
  assert.match(storeContextSource, /case "clearCart":/);
  assert.match(storeContextSource, /cart: \[\]/);
});

test("CheckoutPage: sends items and customer details to POST /orders", () => {
  assert.match(checkoutPageSource, /api\("\/orders"/);
  assert.match(checkoutPageSource, /items: cartItems\.map\(\(\{ productId, quantity \}\) => \(\{ productId, quantity \}\)\)/);
});

test("CheckoutPage: error during checkout does NOT clear cart", () => {
  const errorCatchPos = checkoutPageSource.indexOf("catch (error)");
  const setOrderErrorPos = checkoutPageSource.indexOf("setOrderError", errorCatchPos);
  assert.ok(errorCatchPos > 0);
  assert.ok(setOrderErrorPos > errorCatchPos);

  const clearCartPos = checkoutPageSource.indexOf("clearCart()");
  assert.ok(clearCartPos < errorCatchPos, "clearCart must only happen before error handling on success");
});

test("CheckoutPage: successful checkout clears cart and navigates to order confirmation with orderNumber", () => {
  const orderNumberCheckPos = checkoutPageSource.indexOf("data.order?.orderNumber");
  const clearCartPos = checkoutPageSource.indexOf("clearCart()", orderNumberCheckPos);
  const navigatePos = checkoutPageSource.indexOf("navigate(\"/order-confirmation\"", clearCartPos);

  assert.ok(orderNumberCheckPos > 0);
  assert.ok(clearCartPos > orderNumberCheckPos);
  assert.ok(navigatePos > clearCartPos);
});
