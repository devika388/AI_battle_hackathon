import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PublicSitePage } from "./pages/PublicSitePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicSitePage />} />
        <Route path="/design-system" element={<DesignSystemPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
