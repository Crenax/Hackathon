import { useEffect, useState } from "react";
import { getMe, type User } from "../api";
import CreateEvent from "../components/CreateEvent";

export default function HomePage() {
    const [me, setMe] = useState<User | undefined>();

    useEffect(() => {
        getMe().then(setMe);
    }, []);

    return (
        <>
            <h1>Current learning sessions</h1>

            <CreateEvent></CreateEvent>
        </>
    );
}
