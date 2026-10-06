import { adminPage } from "@/server/admin/guard";
import { profileData } from "@/server/admin/system";
import { ProfileView } from "@/components/admin/system/account";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const { staff } = await adminPage();
  return <ProfileView p={await profileData(staff)} />;
}
