"use client";
import styles from "./task.module.css";
import { cx } from "../../lib/class-names";
import { useState, type FormEvent } from "react";
import { errorText, listOf, post, remove } from "../../lib/api";
import type { Comment, User } from "../../lib/types";
import { Avatar } from "../../components/ui/avatar";
import { ErrorBanner } from "../../components/ui/feedback";
import { Icon } from "../../components/ui/icon";
import { Loading } from "../../components/ui/loading";
import { timeAgo } from "../../lib/format-date";
import { useResource } from "../../hooks/use-resource";

export interface TaskCommentsProps {
  taskId: string;
  user: User;
  canModerate: boolean;
  onChange: () => void;
}

export function TaskComments({
  taskId,
  user,
  canModerate,
  onChange,
}: TaskCommentsProps) {
  const [page, setPage] = useState(0);
  const resource = useResource<{ comments: Comment[] }>(
    `/tasks/${taskId}/comments?limit=50&offset=${page * 50}`,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(`/tasks/${taskId}/comments`, { content });
      onChange();
      setContent("");
      setPage(0);
      resource.refresh();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function deleteComment(id: string) {
    if (!window.confirm("Delete this comment?")) return;
    setBusy(true);
    try {
      await remove(`/comments/${id}`);
      onChange();
      resource.refresh();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  const comments = [...listOf<Comment>(resource.data, "comments")].reverse();
  return (
    <div className={styles["comments"]}>
      <h3 className={styles["native-h3"]}>
        <Icon name="chat" size={17} />
        Conversation <span className={styles["count"]}>{comments.length}</span>
      </h3>
      <ErrorBanner error={error || resource.error} />
      {resource.loading && !resource.data ? (
        <Loading label="Loading comments…" />
      ) : comments.length ? (
        <div className={styles["comment-list"]}>
          {comments.map((comment) => (
            <div className={styles["comment"]} key={comment.id}>
              <div className={styles["comment-top"]}>
                <Avatar name={comment.author.name} size="small" />
                <strong>{comment.author.name}</strong>
                {(comment.authorId === user.id || canModerate) && (
                  <button
                    className={cx(
                      styles["native-button"],
                      styles["icon-button"],
                    )}
                    disabled={busy}
                    aria-label={`Delete comment by ${comment.author.name}`}
                    onClick={() => deleteComment(comment.id)}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
              <p className={styles["native-p"]}>{comment.content}</p>
              <small>{timeAgo(comment.createdAt)}</small>
            </div>
          ))}
        </div>
      ) : (
        <p
          className={cx(
            styles["native-p"],
            styles["helper"],
            styles["comments-empty"],
          )}
        >
          Share an update, ask a question, or leave a little context for your
          team.
        </p>
      )}
      <div className={styles["comment-pagination"]}>
        <button
          className={cx(styles["native-button"], styles["text-link"])}
          type="button"
          disabled={resource.loading || comments.length < 50}
          onClick={() => setPage((value) => value + 1)}
        >
          Older
        </button>
        <span>Page {page + 1}</span>
        <button
          className={cx(styles["native-button"], styles["text-link"])}
          type="button"
          disabled={resource.loading || page === 0}
          onClick={() => setPage((value) => Math.max(0, value - 1))}
        >
          Newer
        </button>
      </div>
      <form onSubmit={submit} className={styles["form-stack"]}>
        <label
          className={cx(styles["native-label"], styles["sr-only"])}
          htmlFor="comment"
        >
          Add a comment
        </label>
        <textarea
          className={styles["native-textarea"]}
          id="comment"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write a comment…"
          rows={3}
          maxLength={5000}
          required
        />
        <button
          className={cx(
            styles["native-button"],
            styles["button"],
            styles["secondary"],
          )}
          disabled={busy || !content.trim()}
        >
          {busy ? "Posting…" : "Post comment"}
        </button>
      </form>
    </div>
  );
}
