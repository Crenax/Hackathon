import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';

import AppHeader from "./components/AppHeader";
import AppFooter from "./components/AppFooter.tsx";
import IconBackground from "./components/IconBackground";
import { scienceIconAttribution } from "../icons";

import UserSettings from "./pages/UserSettings.tsx";
import HomePage from "./pages/HomePage.tsx";
import UserEvents from "./pages/UserEvents.tsx";
import EventPage from "./pages/EventPage.tsx";
import CreateEvent from "./pages/CreateEvent.tsx";


const MapPage = lazy(() => import("./pages/MapPage"));

const App = () => {
  return (
    <>
      <IconBackground />
      <AppHeader />
      <AppContent />
      <AppFooter />
    </>
  );
};

export default App;



const AppContent = () => {
  return (
    <div className="app-content">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create-event" element={<CreateEvent />}></Route>
          <Route path="/map" element={<Suspense fallback={<p style={{ textAlign: "center" }}>Loading campus map…</p>}><MapPage /></Suspense>} />
          <Route path="/my-events" element={<UserEvents />} />
          <Route path="/my-profile" element={<UserSettings />} />
          <Route path="/event" element={<EventPage />} />
          {/* Unknown URLs (typos, old links) go to the home page instead of an empty page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <div className="icon-attribution">
        <a href={scienceIconAttribution.url}>
          {scienceIconAttribution.text}
        </a>
        <br />
        <a href="https://getbootstrap.com">
          Interface icons by Bootstrap
        </a>
      </div>
    </div>
  );
}
