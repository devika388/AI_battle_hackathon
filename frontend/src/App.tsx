import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DesignSystemPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
