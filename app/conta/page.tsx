import { redirect } from "next/navigation";
import { getAccountUser, accountSignInPath } from "../account-auth";
import { AccountEntry } from "../ui/account-entry";
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await getAccountUser();
  if (!account) redirect(accountSignInPath("/conta"));
  return <AccountEntry initialMode="password" account={{ name: account.name, email: account.email }}/>;
}
