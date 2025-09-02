import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";   // KPI dashboard
import GcrPage from "./pages/GcrPage"; 
import DenialPage from "./pages/DenialPage";
import NcrPage from "./pages/NcrPage";
import FprPage from "./pages/FprPage";
import CcrPage from "./pages/CcrPage";
import TotalPage from "./pages/TotalPage";
import BillingLag from "./pages/BillingLag";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/gcr" element={<GcrPage />} />
        <Route path="/denials" element={<DenialPage />} />
        <Route path="/ncr" element={<NcrPage />} />
        <Route path="/fpr" element={<FprPage />} />
        <Route path="/ccr" element={<CcrPage />} />
         <Route path="/claims" element={<TotalPage />} />
         <Route path="/billinglag" element={<BillingLag />} />
      </Routes>
    </Router>
  );
}

export default App;
