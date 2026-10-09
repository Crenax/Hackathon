import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from "react";
import { getMe, type User } from "./api";

import AppHeader from "./components/AppHeader";
import AppFooter from "./components/AppFooter.tsx";

import UserSettings from "./pages/UserSettings.tsx";
import HomePage from "./pages/HomePage.tsx";


const App = () => {
  const [me, setMe] = useState<User | undefined>();

  useEffect(() => {
    getMe().then(setMe);
  }, []);

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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/profile" element={<UserSettings />} />
      </Routes>
    </BrowserRouter>
  );
}