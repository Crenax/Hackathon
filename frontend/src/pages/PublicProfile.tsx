import { useEffect, useState } from "react";
import { ArrowLeft } from "react-bootstrap-icons";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { acceptFriendRequest, Gender, getUserProfile, sendFriendRequest, type PublicUser } from "../api";
import FriendTag from "../components/FriendTag";
import "../FormLayout.css";
import "./UserSettings.css";
import "./PublicProfile.css";

const GENDER_LABELS: Record<Gender, string> = {
    [Gender.preferNotToSay]: "Prefer not to say",
    [Gender.male]: "Male",
    [Gender.female]: "Female",
    [Gender.nonBinary]: "Non-binary",
};

// "2003-05-14" -> localized date, without shifting the day through time zones
function formatBirthDate(value: string | null): string {
    if (!value) return "Not provided";
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString(undefined, { dateStyle: "long" });
}

interface ProfileState {
    userId: string;
    profile?: PublicUser;
    error?: string;
}

// Read-only view of another user's profile, opened from names on the event page
export default function PublicProfile() {
    const [searchParams] = useSearchParams();
    const userId = searchParams.get("id")?.trim() ?? "";
    const [state, setState] = useState<ProfileState>({ userId: "" });
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!userId) return;
        let isActive = true;
        getUserProfile(userId)
            .then((profile) => { if (isActive) setState({ userId, profile }); })
            .catch((error: unknown) => {
                if (isActive) setState({
                    userId,
                    error: error instanceof Error ? error.message : "Could not load this profile.",
                });
            });
        return () => {
            isActive = false;
        };
    }, [userId]);

    function goBack() {
        // "default" means the page was opened directly, with no in-app page to go back to
        if (location.key !== "default") navigate(-1);
        else navigate("/", { replace: true });
    }

    const profile = state.userId === userId ? state.profile : undefined;
    const [isFriendActionRunning, setIsFriendActionRunning] = useState(false);
    const [friendError, setFriendError] = useState("");

    // "Send friend request" for strangers, "Accept friend request" if they asked first
    async function runFriendAction() {
        if (!profile || isFriendActionRunning) return;
        setIsFriendActionRunning(true);
        setFriendError("");
        try {
            const updated = profile.friendStatus === "request_received"
                ? await acceptFriendRequest(profile.id)
                : await sendFriendRequest(profile.id);
            setState({ userId, profile: updated });
        } catch (error) {
            setFriendError(error instanceof Error ? error.message : "Could not update the friendship.");
        } finally {
            setIsFriendActionRunning(false);
        }
    }
    const error = !userId ? "No user id was provided in the URL." : state.userId === userId ? state.error : undefined;

    return (
        <main className="form-page">
            <div className="form-container">
                <div className="public-profile__header-row">
                    <button className="public-profile__back" type="button" onClick={goBack} aria-label="Go back to the previous page" title="Back">
                        <ArrowLeft aria-hidden="true" />
                    </button>
                    <header className="form-page-header">
                        <p className="form-eyebrow">Profile</p>
                        <h1>
                            {profile ? profile.fullName.trim() || "Name unavailable" : "User profile"}
                            {profile?.friendStatus === "friends" && <FriendTag />}
                        </h1>
                        {profile && (profile.friendStatus === "none" || profile.friendStatus === "request_received") && (
                            <button className="form-primary-button public-profile__friend-button" type="button"
                                disabled={isFriendActionRunning} onClick={() => void runFriendAction()}>
                                {profile.friendStatus === "request_received"
                                    ? (isFriendActionRunning ? "Accepting…" : "Accept friend request")
                                    : (isFriendActionRunning ? "Sending…" : "Send friend request")}
                            </button>
                        )}
                        {profile?.friendStatus === "request_sent" && (
                            <p className="public-profile__friend-note">Friend request sent</p>
                        )}
                        {friendError && <p className="profile-message profile-message--error" role="alert">{friendError}</p>}
                    </header>
                </div>

                {error ? (
                    <p className="form-card profile-message profile-message--error" role="alert">{error}</p>
                ) : !profile ? (
                    <p className="form-card" role="status">Loading profile…</p>
                ) : (
                    <>
                        <section className="form-card" aria-labelledby="public-personal-heading">
                            <div className="form-section-header">
                                <h2 id="public-personal-heading">Personal information</h2>
                            </div>
                            <dl className="public-profile__details">
                                <div>
                                    <dt>Full name</dt>
                                    <dd>{profile.fullName.trim() || "Not provided"}</dd>
                                </div>
                                <div>
                                    <dt>Gender</dt>
                                    <dd>{profile.gender ? GENDER_LABELS[profile.gender] : "Not specified"}</dd>
                                </div>
                                <div>
                                    <dt>Date of birth</dt>
                                    <dd>{formatBirthDate(profile.dateOfBirth)}</dd>
                                </div>
                            </dl>
                        </section>

                        <section className="form-card" aria-labelledby="public-about-heading">
                            <div className="form-section-header">
                                <h2 id="public-about-heading">About</h2>
                            </div>
                            <p className="public-profile__about">{profile.description.trim() || "No description yet."}</p>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
