import { initSatellite } from "@junobuild/core";
import { FC, useEffect } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout.tsx";
import { Toaster } from "sonner";
import { ConfirmProvider } from "./contexts/ConfirmContext";

const App: FC = () => {
  useEffect(() => {
    (async () =>
      await initSatellite({
        workers: {
          auth: true,
        },
      }))();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfirmProvider>
          <Layout />
          <Toaster
            position="bottom-center"
            richColors
            closeButton
            duration={6000}
          />
        </ConfirmProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
