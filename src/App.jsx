import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";   // KPI dashboard
import GcrPage from "./pages/GcrPage"; 
import DenialPage from "./pages/DenialPage";
import NcrPage from "./pages/NcrPage";
import FprPage from "./pages/FprPage";
import CcrPage from "./pages/CcrPage";
import TotalPage from "./pages/TotalPage";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/gcr" element={<GcrPage />} />
        <Route path="/denial" element={<DenialPage />} />
        <Route path="/ncr" element={<NcrPage />} />
        <Route path="/fpr" element={<FprPage />} />
        <Route path="/ccr" element={<CcrPage />} />
         <Route path="/claim" element={<TotalPage />} />
      </Routes>
    </Router>
  );
}

export default App;
