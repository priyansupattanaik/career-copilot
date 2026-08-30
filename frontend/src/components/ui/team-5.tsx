import type { ElementType, ReactNode } from "react";
import { FaDribbble, FaGithub, FaGlobe, FaLinkedinIn } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type Team5SocialPlatform =
  | "linkedin"
  | "github"
  | "twitter"
  | "dribbble"
  | "website";

export interface Team5Social {
  platform: Team5SocialPlatform;
  url: string;
  label?: string;
}

export interface Team5Member {
  id: string;
  name: string;
  role?: string;
  image: string;
  socials?: Team5Social[];
}

export interface Team5Props {
  badge?: string;
  heading?: string;
  description?: string;
  members?: Team5Member[];
  className?: string;
  renderLink?: (props: {
    href: string;
    label: string;
    children: ReactNode;
  }) => ReactNode;
}

const socialIconMap: Record<Team5SocialPlatform, ElementType> = {
  linkedin: FaLinkedinIn,
  github: FaGithub,
  twitter: FaXTwitter,
  dribbble: FaDribbble,
  website: FaGlobe,
};

/** Team members for Career Copilot. */
const defaultMembers: Team5Member[] = [
  {
    id: "daji-adelkar",
    name: "Daji Adelkar",
    image: "/team/daji-adelkar.jpg",
    socials: [
      {
        platform: "linkedin",
        url: "https://www.linkedin.com/in/daji-adelkar-b16858269/",
        label: "Daji Adelkar on LinkedIn",
      },
    ],
  },
  {
    id: "ronak-k",
    name: "Ronak K.",
    image: "/team/ronak-k.jpg",
    socials: [
      {
        platform: "linkedin",
        url: "https://www.linkedin.com/in/ronak-k-2b1974214/",
        label: "Ronak K. on LinkedIn",
      },
    ],
  },
  {
    id: "pratik-bamhane",
    name: "Pratik Bamhane",
    image: "/team/pratik-bamhane.jpg",
    socials: [
      {
        platform: "linkedin",
        url: "https://www.linkedin.com/in/pratik-bamhane/",
        label: "Pratik Bamhane on LinkedIn",
      },
    ],
  },
  {
    id: "mohammad-faizan-khan",
    name: "Mohammad Faizan Khan",
    image: "/team/mohammad-faizan-khan.jpg",
    socials: [
      {
        platform: "linkedin",
        url: "https://www.linkedin.com/in/13faizankhan/",
        label: "Mohammad Faizan Khan on LinkedIn",
      },
    ],
  },
  {
    id: "priyansu-pattanaik",
    name: "Priyansu Pattanaik",
    image: "/team/priyansu-pattanaik.jpg",
    socials: [
      {
        platform: "linkedin",
        url: "https://www.linkedin.com/in/priyansupattanaik/",
        label: "Priyansu Pattanaik on LinkedIn",
      },
    ],
  },
];

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function MemberSocialLinks({
  member,
  renderLink,
}: {
  member: Team5Member;
  renderLink?: Team5Props["renderLink"];
}) {
  const socials = (member.socials || []).filter((social) =>
    isHttpUrl(social.url),
  );
  if (!socials.length) return null;

  return (
    <div className="team5-socials flex items-center gap-2">
      {socials.map((social) => {
        const Icon = socialIconMap[social.platform];
        if (!Icon) return null;

        const label = social.label ?? `${member.name} on ${social.platform}`;

        const content = (
          <span className="team5-social flex size-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-zinc-950">
            <Icon className="size-3.5" aria-hidden />
          </span>
        );

        if (renderLink) {
          return (
            <span key={`${social.platform}-${social.url}`}>
              {renderLink({ href: social.url, label, children: content })}
            </span>
          );
        }

        return (
          <a
            key={`${social.platform}-${social.url}`}
            href={social.url}
            aria-label={label}
            target="_blank"
            rel="noopener noreferrer"
          >
            {content}
          </a>
        );
      })}
    </div>
  );
}

function MemberStrip({
  member,
  renderLink,
}: {
  member: Team5Member;
  renderLink?: Team5Props["renderLink"];
}) {
  return (
    <article
      className={cn(
        "team5-member group relative min-w-0 flex-[1] overflow-hidden rounded-lg",
        "cursor-pointer shadow-sm transition-all duration-500",
        "hover:flex-[3] hover:shadow-xl focus-within:flex-[3] focus-within:shadow-xl",
      )}
      tabIndex={0}
    >
      <img
        src={member.image}
        alt={`Portrait of ${member.name}`}
        className="team5-photo absolute inset-0 h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0 group-focus-within:grayscale-0"
        loading="lazy"
      />

      <div className="team5-shade absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />

      <div className="team5-meta absolute inset-x-0 bottom-0 flex translate-y-3 flex-col gap-3 p-5 opacity-0 transition-all delay-100 duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 sm:p-6">
        {member.role ? (
          <Badge variant="secondary" className="w-fit text-xs">
            {member.role}
          </Badge>
        ) : null}

        <h3 className="text-xl font-semibold tracking-tight whitespace-nowrap text-white sm:text-2xl">
          {member.name}
        </h3>

        <MemberSocialLinks member={member} renderLink={renderLink} />
      </div>
    </article>
  );
}

export default function Team5({
  badge,
  heading = "The team",
  description = "Five minds. One mission. We ship products that matter.",
  members = defaultMembers,
  className,
  renderLink,
}: Team5Props) {
  return (
    <section
      className={cn("team5 bg-background w-full py-16 sm:py-24", className)}
    >
      <div className="team5-inner mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="team5-copy mb-10 flex flex-col items-center text-center sm:mb-14">
          {badge ? <p className="home-kicker">{badge}</p> : null}
          {heading ? (
            <h2
              id="team-title"
              className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl"
            >
              {heading}
            </h2>
          ) : null}

          {description ? (
            <p className="text-muted-foreground mt-4 max-w-xl text-base sm:text-lg">
              {description}
            </p>
          ) : null}
        </div>

        <div className="team5-row flex h-72 gap-1.5 sm:h-80 sm:gap-2 md:h-96">
          {members.map((member) => (
            <MemberStrip
              key={member.id}
              member={member}
              renderLink={renderLink}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export { Team5, defaultMembers };
