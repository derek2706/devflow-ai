import styles from "./ui.module.css";
import { cx } from "../../lib/class-names";
import { Icon } from "./icon";

export function Empty({
  icon = "folder",
  title,
  description,
  children,
  className,
}: {
  icon?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(styles["empty"], className)}>
      <span className={styles["empty-icon"]}>
        <Icon name={icon} size={26} />
      </span>
      <h3 className={styles["native-h3"]}>{title}</h3>
      <p className={styles["native-p"]}>{description}</p>
      {children}
    </div>
  );
}
