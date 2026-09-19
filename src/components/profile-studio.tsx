"use client";

import Image from "next/image";
import { useState } from "react";

const AVATARS = [
  "Songkok scholar",
  "Hijab bookworm",
  "Long-hair hunter",
  "Kopiah rider",
  "Specs thinker",
  "Bun hoodie",
  "Bearded scout",
  "Braid + jasmine",
  "Black hijab specs",
  "Headphones kid",
  "Bob sketcher",
  "Locs ranger",
] as const;

const TONES = ["Fair", "Light", "Medium", "Tan", "Deep"] as const;

type Tone = (typeof TONES)[number];

function toneClass(tone: Tone): string {
  return `avatar--tone-${tone.toLowerCase()}`;
}

/**
 * A presentation-only profile workshop from the approved visual handoff.
 *
 * Profile updates and avatar persistence need the proposed account contract,
 * so the controls deliberately update this preview only. The surrounding
 * FixtureNotice makes that boundary explicit to the reader.
 */
export function ProfileStudio() {
  const [avatar, setAvatar] = useState(1);
  const [tone, setTone] = useState<Tone>("Medium");
  const avatarName = AVATARS[avatar] ?? AVATARS[1];

  return (
    <section className="profile-workshop" aria-labelledby="profile-studio-title">
      <article className="hunter-licence poster-paper pin" aria-labelledby="profile-studio-title">
        <Image
          className={`hunter-licence__portrait avatar ${toneClass(tone)}`}
          src={`/brand/avatar-${avatar}.webp`}
          alt={`Fixture avatar: ${avatarName}`}
          width={320}
          height={320}
          unoptimized
        />
        <div className="hunter-licence__identity">
          <h2 className="hunter-licence__name" id="profile-studio-title">
            Your hunter licence
          </h2>
          <span className="hunter-licence__meta">Fixture presentation preview</span>
          <span className="hunter-licence__character">{avatarName}</span>
        </div>
        <p className="hunter-licence__bio">
          This licence previews a visual identity only. It does not represent an account, an
          institution, or a verification state.
        </p>
      </article>

      <div className="profile-workshop__editors panel">
        <fieldset className="choice-fieldset">
          <legend>Choose a tone</legend>
          <div className="tone-choices" role="radiogroup" aria-label="Choose a tone">
            {TONES.map((option) => {
              const id = `tone-${option.toLowerCase()}`;

              return (
                <label className="tone-choice" htmlFor={id} key={option}>
                  <input
                    checked={tone === option}
                    id={id}
                    name="tone"
                    onChange={() => setTone(option)}
                    type="radio"
                    value={option.toLowerCase()}
                  />
                  <span className="tone-choice__face">
                    <span
                      aria-hidden="true"
                      className={`tone-choice__swatch tone-choice__swatch--${option.toLowerCase()}`}
                    />
                    {option}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="choice-fieldset">
          <legend>Choose an avatar</legend>
          <div className="avatar-choices" role="radiogroup" aria-label="Choose an avatar">
            {AVATARS.map((option, index) => {
              const id = `avatar-${index}`;

              return (
                <label className="avatar-choice" htmlFor={id} key={option}>
                  <input
                    checked={avatar === index}
                    id={id}
                    name="avatar"
                    onChange={() => setAvatar(index)}
                    type="radio"
                    value={String(index)}
                  />
                  <span className="avatar-choice__face">
                    <Image
                      className={`avatar ${toneClass(tone)}`}
                      src={`/brand/avatar-${index}.webp`}
                      alt=""
                      width={110}
                      height={110}
                      unoptimized
                    />
                  </span>
                  <span className="avatar-choice__label">{option}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <p className="profile-form__outcome">
          Changes stay in this browser preview and are not saved to an account.
        </p>
      </div>
    </section>
  );
}
