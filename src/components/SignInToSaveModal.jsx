/**
 * Back-compat wrapper — prefer AccountModal for new call sites.
 * Heart / save gates historically imported this name.
 */
import AccountModal from "./AccountModal";

export default function SignInToSaveModal({
  open,
  onClose,
  onSuccess,
  title,
  subtitle,
}) {
  return (
    <AccountModal
      open={open}
      onClose={onClose}
      onSuccess={onSuccess}
      purpose="save-home"
      title={title}
      subtitle={subtitle}
      askIntent
      showSuccess={false}
    />
  );
}
