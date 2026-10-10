import { FormEvent, useState } from 'react';

export default function UserSettings() {
    const [courses, setCourses] = useState<string[]>([]);
    const [courseInput, setCourseInput] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'private'>('public');

    function addCourse() {
        const course = courseInput.trim();
        if (course && !courses.some((item) => item.toLowerCase() === course.toLowerCase())) {
            setCourses((current) => [...current, course]);
        }
        setCourseInput('');
    }

    function submitProfile(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        // Profile persistence can be connected to the account API when available.
    }

    return (
        <main className="profile-page">
            <form className="profile-form" onSubmit={submitProfile}>
                <header className="profile-heading">
                    <p className="profile-eyebrow">Your account</p>
                    <h1>Create your profile</h1>
                    <p>Introduce yourself and choose what other people can see.</p>
                </header>

                <section className="profile-section" aria-labelledby="personal-heading">
                    <h2 id="personal-heading">Personal information</h2>
                    <label className="profile-field">
                        <span>Full name <span className="required">*</span></span>
                        <input name="name" type="text" autoComplete="name" placeholder="Your name" required />
                    </label>
                    <label className="profile-field">
                        <span>Email address <span className="required">*</span></span>
                        <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
                    </label>
                    <label className="profile-field">
                        <span>Username <span className="required">*</span></span>
                        <input name="username" type="text" autoComplete="username" placeholder="Choose a username" required />
                    </label>
                </section>

                <section className="profile-section" aria-labelledby="about-heading">
                    <h2 id="about-heading">About you</h2>
                    <label className="profile-field">
                        <span>Description</span>
                        <textarea name="description" rows={4} maxLength={300} placeholder="A little about yourself (optional)" />
                        <small>Up to 300 characters.</small>
                    </label>
                    <div className="profile-field">
                        <label htmlFor="course-input">Courses you take</label>
                        <div className="course-entry">
                            <input
                                id="course-input"
                                type="text"
                                value={courseInput}
                                onChange={(event) => setCourseInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        addCourse();
                                    }
                                }}
                                placeholder="For example, Biology 101"
                            />
                            <button className="add-course" type="button" onClick={addCourse}>Add course</button>
                        </div>
                        <small>Add each course separately.</small>
                        {courses.length > 0 && (
                            <ul className="course-list" aria-label="Added courses">
                                {courses.map((course) => (
                                    <li key={course}>
                                        {course}
                                        <button type="button" aria-label={`Remove ${course}`} onClick={() => setCourses((current) => current.filter((item) => item !== course))}>Remove</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                <section className="profile-section" aria-labelledby="privacy-heading">
                    <h2 id="privacy-heading">Profile visibility</h2>
                    <p className="section-description">Choose who can view your profile.</p>
                    <div className="visibility-options">
                        <label className="visibility-option">
                            <input type="radio" name="visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} />
                            <span><strong>Public</strong><small>Other members can see your profile and courses.</small></span>
                        </label>
                        <label className="visibility-option">
                            <input type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} />
                            <span><strong>Private</strong><small>Only you can see your profile details.</small></span>
                        </label>
                    </div>
                </section>

                <button className="save-profile" type="submit">Create profile</button>
            </form>

            <style>{`
                .profile-page { min-height: 100vh; box-sizing: border-box; padding: 32px 16px; background: #f3f4f6; color: #111827; }
                .profile-form { width: 100%; max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
                .profile-heading { padding: 8px 2px 4px; }
                .profile-eyebrow { margin: 0 0 6px; color: #4f46e5; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
                .profile-heading h1 { margin: 0; font-size: clamp(26px, 7vw, 34px); line-height: 1.2; }
                .profile-heading > p:last-child { margin: 9px 0 0; color: #6b7280; }
                .profile-section { display: flex; flex-direction: column; gap: 18px; padding: 22px; border: 1px solid #e5e7eb; border-radius: 16px; background: white; box-shadow: 0 4px 14px rgba(15, 23, 42, .03); }
                .profile-section h2 { margin: 0; font-size: 19px; }
                .section-description { margin: -12px 0 0; color: #6b7280; font-size: 14px; }
                .profile-field { display: flex; flex-direction: column; gap: 8px; color: #374151; font-size: 14px; font-weight: 600; }
                .profile-field input, .profile-field textarea, .course-entry input { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 10px; padding: 12px; background: #fff; color: #111827; font: inherit; font-weight: 400; }
                .profile-field textarea { resize: vertical; min-height: 100px; }
                .profile-field input:focus, .profile-field textarea:focus, .course-entry input:focus { outline: 3px solid #c7d2fe; border-color: #6366f1; }
                .profile-field small { color: #6b7280; font-size: 12px; font-weight: 400; }
                .required { color: #b91c1c; }
                .course-entry { display: flex; gap: 8px; }
                .add-course { flex: 0 0 auto; border: 1px solid #d1d5db; border-radius: 10px; padding: 0 14px; background: #f9fafb; color: #111827; font: inherit; font-weight: 600; cursor: pointer; }
                .course-list { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
                .course-list li { display: flex; align-items: center; gap: 8px; border-radius: 999px; padding: 7px 10px; background: #eef2ff; color: #3730a3; font-size: 13px; }
                .course-list button { border: 0; padding: 0; background: transparent; color: #4338ca; font: inherit; text-decoration: underline; cursor: pointer; }
                .visibility-options { display: flex; flex-direction: column; gap: 10px; }
                .visibility-option { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border: 1px solid #e5e7eb; border-radius: 12px; cursor: pointer; }
                .visibility-option input { margin: 3px 0 0; accent-color: #4f46e5; }
                .visibility-option span { display: flex; flex-direction: column; gap: 4px; }
                .visibility-option small { color: #6b7280; line-height: 1.4; }
                .save-profile { width: 100%; min-height: 48px; border: 0; border-radius: 10px; background: #312e81; color: white; font: inherit; font-weight: 700; cursor: pointer; }
                @media (max-width: 420px) { .profile-page { padding: 22px 12px; } .profile-section { padding: 18px 16px; } .course-entry { flex-direction: column; } .add-course { min-height: 44px; } }
            `}</style>
        </main>
    );
}
