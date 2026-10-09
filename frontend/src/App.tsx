import { useEffect, useState } from "react";
import { getMe, type User } from "./api";
import AppHeader from "./components/AppHeader";
import AppFooter from "./components/AppFooter.tsx";
import Todos from "./components/Todos";

const App = () => {
  const [me, setMe] = useState<User | undefined>();

  useEffect(() => {
    getMe().then(setMe);
  }, []);

  return (
    <>
      <AppHeader />
      <Todos me={me} />
      <AppFooter />
    </>
  );
};

export default App;
