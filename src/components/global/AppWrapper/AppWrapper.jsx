import { useEffectAsync } from "@fyclabs/tools-fyc-react/utils";
import { $global } from "@src/signals";
import {
  getCurrentAuthenticatedUser,
  handleFirebaseLogin,
  handleFirebaseLogout,
} from "@src/utils/auth";
import { auth } from "@src/utils/firebase";
import {
  destroyUserback,
  initializeUserback,
  updateUserbackUser,
} from "@src/utils/userback";
import useWindowSize from "@src/utils/windowSize";
import { Badge, Container } from "react-bootstrap";
import { Outlet } from "react-router-dom";
import Loadable from "../Loadable";

const AppWrapper = () => {
  const { breakPoint } = useWindowSize();

  useEffectAsync(async () => {
    // Initialize Userback on mount
    await initializeUserback();

    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      $global.update({
        isLoading: true,
      });
      if (fbUser) {
        await handleFirebaseLogin(fbUser);
        const user = await getCurrentAuthenticatedUser();
        // Update Userback with user data after authentication
        if (user) {
          await updateUserbackUser(user);
        }
      } else if ($global.value.isSignedIn) {
        await handleFirebaseLogout();
        await updateUserbackUser(null);
      }

      $global.update({
        isLoading: false,
      });
    });

    return () => {
      unsubscribe();
      destroyUserback();
    };
  }, []);

  return (
    <Container fluid className="p-0">
      {import.meta.env.VITE_DEV_IS_BREAKPOINT_VISABLE === "true" && (
        <Badge bg="primary" className="breakpointBadge">
          {breakPoint}
        </Badge>
      )}
      <Loadable signal={$global}>
        <Outlet />
      </Loadable>
    </Container>
  );
};

export default AppWrapper;
