import { getRoleUser } from '@/lib/roleSession';
import NotificationCenter from '@/components/notificationCenter';
export const metadata = { title: 'Notifications | Synoria' };
export default async function Page() { await getRoleUser('supervisor'); return <main className="mx-auto max-w-[1100px] px-[5%] py-10"><h1 className="mb-8 mt-0 text-3xl font-semibold">Notifications</h1><NotificationCenter /></main>; }
