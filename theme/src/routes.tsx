import { createHashRouter } from "react-router";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import ProductListing from "./pages/ProductListing";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import Checkout from "./pages/Checkout";
import Account from "./pages/Account";
import Offers from "./pages/Offers";
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";

export const router = createHashRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "shop/:category", Component: ProductListing },
      { path: "shop/:category/:subcategory", Component: ProductListing },
      { path: "product/:id", Component: ProductDetail },
      { path: "cart", Component: Cart },
      { path: "wishlist", Component: Wishlist },
      { path: "checkout", Component: Checkout },
      { path: "account", Component: Account },
      { path: "offers", Component: Offers },
      { path: "search", Component: Search },
      { path: "*", Component: NotFound },
    ],
  },
]);
