import { Navigate, Route, Routes } from "react-router";
import { StyleGuidePage } from "./features/styleguide/StyleGuidePage";

function App() {
  return (
    <Routes>
      <Route path="/styleguide" element={<StyleGuidePage />} />
      <Route path="*" element={<Navigate to="/styleguide" replace />} />
    </Routes>
  );
}

export default App; // guard-ignore: replaced by the TanStack router in checkpoint 4.
