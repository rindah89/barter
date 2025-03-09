/**
 * Returns a default avatar URL from a placeholder service
 * @param name Optional name to use for the avatar
 */
export const getDefaultAvatar = (name?: string | null): string => {
  const userName = name ? encodeURIComponent(name) : 'User';
  return `https://ui-avatars.com/api/?name=${userName}&background=FF6B6B&color=fff&size=100`;
}; 