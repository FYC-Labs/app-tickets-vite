import Userback from '@userback/widget';

let userbackInstance = null;
const USERBACK_TOKEN = 'A-ksUnFdmWEsWU3CvfGKILuh0kK';

/**
 * Initialize Userback with optional user data
 * @param {Object} user - User object with id, email, first_name, last_name
 */
export const initializeUserback = async (user = null) => {
  try {
    const options = {};

    if (user) {
      options.user_data = {
        id: user.id || user.firebase_uid || '',
        info: {
          name: user.first_name && user.last_name
            ? `${user.first_name} ${user.last_name}`
            : user.first_name || user.last_name || user.display_name || '',
          email: user.email || '',
        },
      };
    }

    // Initialize Userback
    userbackInstance = await Userback(USERBACK_TOKEN, options);
  } catch (error) {
    console.error('Error initializing Userback:', error);
  }
};

/**
 * Update Userback user data
 * @param {Object} user - User object with id, email, first_name, last_name, or null to clear
 */
export const updateUserbackUser = async (user) => {
  if (!userbackInstance) {
    await initializeUserback(user);
    return;
  }

  try {
    if (user) {
      const userId = user.id || user.firebase_uid || '';
      const userName = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.first_name || user.last_name || user.display_name || '';
      const userEmail = user.email || '';

      userbackInstance.identify(userId, {
        name: userName,
        email: userEmail,
      });
    } else {
      // Clear user identification on logout
      userbackInstance.identify(null);
    }
  } catch (error) {
    console.error('Error updating Userback user:', error);
  }
};

/**
 * Destroy Userback instance (for cleanup)
 */
export const destroyUserback = () => {
  // Userback doesn't have a destroy method, just reset the instance
  userbackInstance = null;
};
