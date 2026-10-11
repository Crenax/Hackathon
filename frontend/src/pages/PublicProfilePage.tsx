import { useEffect, useState } from "react";
import { PersonCircle } from "react-bootstrap-icons";
import { useParams } from "react-router-dom";
import { getPublicProfile, type PublicProfile } from "../api";
import BackButton from "../components/BackButton";
import "../FormLayout.css";
import "./PublicProfilePage.css";

interface ProfileLoadState {
    userId: string;
    profile?: PublicProfile;
    error?: string;
}

export default function PublicProfilePage() {
    const { userId = "" } = useParams();
    const [loadState, setLoadState] = useState<ProfileLoadState>({ userId: "" });

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, [userId]);

    useEffect(() => {
        if (!userId) return;

        let active = true;
        getPublicProfile(userId)
            .then((profile) => {
                if (active) setLoadState({ userId, profile });
            })
            .catch((error: unknown) => {
                if (!active) return;
                const message = error instanceof Error ? error.message : "Unknown error";
                setLoadState({ userId, error: `Could not load this profile: ${message}` });
            });

        return () => {
            active = false;
        };
    }, [userId]);

    let content;
    if (!userId) {
        content = <p className="form-card" role="alert">No member id was provided.</p>;
    } else if (loadState.userId !== userId) {
        content = <p className="form-card" role="status">Loading profile…</p>;
    } else if (loadState.error) {
        content = <p className="form-card" role="alert">{loadState.error}</p>;
    } else if (loadState.profile) {
        const fullName = loadState.profile.fullName.trim() || "Name unavailable";
        const description = loadState.profile.description.trim() || "This member has not added an about-me text yet.";
        content = (
            <article className="form-card public-profile__card" aria-labelledby="public-profile-name">
                <header className="public-profile__header">
                    <PersonCircle aria-hidden="true" />
                    <div>
                        <p className="form-eyebrow">Public profile</p>
                        <h1 id="public-profile-name">{fullName}</h1>
                    </div>
                </header>
                <section aria-labelledby="public-profile-about">
                    <h2 id="public-profile-about">About me</h2>
                    <p className="public-profile__description">{description}</p>
                </section>
            </article>
        );
    } else {
        content = <p className="form-card" role="status">Loading profile…</p>;
    }

    return (
        <main className="form-page public-profile-page">
            <div className="form-container">
                <div className="public-profile__content-row">
                    <BackButton />
                    <div className="public-profile__content">
                        {content}
                    </div>
                </div>
            </div>
        </main>
    );
}
