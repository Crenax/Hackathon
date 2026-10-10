import { useEffect, useState } from "react";
import { getMe, type User } from "../api";
import CreateEvent from "../components/EventsList";

export default function HomePage() {
    const [me, setMe] = useState<User | undefined>();

    useEffect(() => {
        getMe().then(setMe);
    }, []);

    return (
        <>
            <CreateEvent></CreateEvent>
        </>
    );
}
