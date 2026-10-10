import { BrowserRouter, Routes, Route } from 'react-router-dom';

import AppHeader from "./components/AppHeader";
import AppFooter from "./components/AppFooter.tsx";

import UserSettings from "./pages/UserSettings.tsx";
import HomePage from "./pages/HomePage.tsx";


const App = () => {
  return (
    <>
      <AppHeader />
      <AppContent />
      <AppFooter />
    </>
  );
};

export default App;



const AppContent = () => {
  return (
    <div style={{paddingBottom: "3rem"}}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<UserSettings />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
