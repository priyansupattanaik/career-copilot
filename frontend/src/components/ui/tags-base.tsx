'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, MotionConfig } from 'motion/react';
import { X } from 'lucide-react';

export type Tag = {
  id: string;
  label: string;
};

export type TagsProps = {
  tags?: Tag[];
  selected?: Tag[];
  onSelectedChange?: (selected: Tag[]) => void;
  title?: string;
  className?: string;
};

const DEFAULT_TAGS: Tag[] = [
  { id: 'javascript', label: 'Javascript' },
  { id: 'express', label: 'Express' },
  { id: 'vue', label: 'Vue' },
  { id: 'jest', label: 'Jest' },
  { id: 'next', label: 'Next' },
  { id: 'typescript', label: 'Typescript' },
  { id: 'redis', label: 'Redis' },
  { id: 'git', label: 'Git' },
  { id: 'node', label: 'Node' },
];

export function Tags({
  tags = DEFAULT_TAGS,
  selected: controlledSelected,
  onSelectedChange,
  title = 'TAGS',
  className = '',
}: TagsProps) {
  const [internalSelecteds, setInternalSelecteds] = useState<Tag[]>([]);
  const selecteds = controlledSelected !== undefined ? controlledSelected : internalSelecteds;

  const setSelecteds = (updater: Tag[] | ((prev: Tag[]) => Tag[])) => {
    const next = typeof updater === 'function' ? updater(selecteds) : updater;
    if (controlledSelected === undefined) {
      setInternalSelecteds(next);
    }
    onSelectedChange?.(next);
  };

  const selectedsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedsContainerRef.current) {
      selectedsContainerRef.current.scrollTo({
        left: selectedsContainerRef.current.scrollWidth,
        behavior: 'smooth',
      });
    }
  }, [selecteds]);

  const removeSelectedTag = (id: string) => {
    setSelecteds((prev) => prev.filter((tag) => tag.id !== id));
  };

  const addSelectedTag = (tag: Tag) => {
    setSelecteds((prev) => [...prev, tag]);
  };

  return (
    <MotionConfig transition={{ type: 'spring', stiffness: 300, damping: 40 }}>
      <div className={`theme-injected relative flex w-85 flex-col p-6 font-sans sm:w-sm ${className}`.trim()}>
        {title ? (
          <motion.h2
            layout
            className="font-sans text-xl font-semibold text-foreground"
          >
            {title}
          </motion.h2>
        ) : null}
        <motion.div
          ref={selectedsContainerRef}
          layout
          className="mt-2 mb-3 flex min-h-14 w-full flex-wrap gap-1.5 rounded-2xl border-[1.6px] border-border bg-card p-1.5"
        >
          {selecteds.map((tag) => (
            <motion.div
              key={tag.id}
              layoutId={`tag-${tag.id}`}
              className="flex w-fit items-center gap-1 border-[1.6px] border-border bg-background py-1 pr-1 pl-3"
              style={{ borderRadius: 10, zIndex: 20 }}
            >
              <motion.span
                layoutId={`tag-${tag.id}-label`}
                className="truncate font-sans font-medium text-foreground"
              >
                {tag.label}
              </motion.span>

              <button
                type="button"
                title="close"
                onClick={() => removeSelectedTag(tag.id)}
                className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                aria-label={`Remove ${tag.label}`}
              >
                <X className="size-5 text-muted-foreground" />
              </button>
            </motion.div>
          ))}
        </motion.div>
        {tags.length > selecteds.length && (
          <motion.div
            layout
            className="w-full rounded-2xl border-[1.6px] border-border bg-card p-2"
          >
            <motion.div className="flex flex-wrap gap-2">
              {tags
                .filter(
                  (tag) =>
                    !selecteds.some((selected) => selected.id === tag.id),
                )
                .map((tag) => (
                  <motion.button
                    key={tag.id}
                    type="button"
                    layoutId={`tag-${tag.id}`}
                    onClick={() => addSelectedTag(tag)}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-4 py-2.5 transition-colors hover:bg-background"
                    style={{ borderRadius: 10, zIndex: 10 }}
                  >
                    <motion.span
                      layoutId={`tag-${tag.id}-label`}
                      className="font-sans font-medium text-muted-foreground"
                    >
                      {tag.label}
                    </motion.span>
                  </motion.button>
                ))}
            </motion.div>
          </motion.div>
        )}
      </div>
    </MotionConfig>
  );
}

export default Tags;
