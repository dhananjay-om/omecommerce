import { HashRouter, Routes, Route } from "react-router";
import { ShopProvider } from "./context/ShopContext";
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

export default function App() {
  return (
    <ShopProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="shop/:category" element={<ProductListing />} />
            <Route path="shop/:category/:subcategory" element={<ProductListing />} />
            <Route path="product/:id" element={<ProductDetail />} />
            <Route path="cart" element={<Cart />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="account" element={<Account />} />
            <Route path="offers" element={<Offers />} />
            <Route path="search" element={<Search />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </ShopProvider>
  );
}
