import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';

import AppHeader from "./components/AppHeader";
import IconBackground from "./components/IconBackground";
import { scienceIconAttribution } from "../icons";

import UserSettings from "./pages/UserSettings.tsx";
import HomePage from "./pages/HomePage.tsx";
import UserEvents from "./pages/UserEvents.tsx";
import EventPage from "./pages/EventPage.tsx";
import PublicProfile from "./pages/PublicProfile.tsx";
import Friends from "./pages/Friends.tsx";
import CreateEvent from "./pages/CreateEvent.tsx";


const MapPage = lazy(() => import("./pages/MapPage"));

const App = () => {
  return (
    <>
      <IconBackground />
      <AppHeader />
      <AppContent />
    </>
  );
};

export default App;



const AppContent = () => {
  return (
    <div className="app-content">
      <BrowserRouter>
        <Suspense fallback={
          <div className="route-loading" role="status" aria-live="polite">
            <span className="route-loading-spinner" aria-hidden="true" />
            <p>Loading page…</p>
          </div>
        }>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create-event" element={<CreateEvent />}></Route>
            <Route path="/map" element={<MapPage />} />
            <Route path="/my-events" element={<UserEvents />} />
            <Route path="/my-profile" element={<UserSettings />} />
            <Route path="/event" element={<EventPage />} />
            <Route path="/user" element={<PublicProfile />} />
          <Route path="/friends" element={<Friends />} />
            {/* Unknown URLs (typos, old links) go to the home page instead of an empty page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
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
