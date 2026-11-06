import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { ArknightsSettings } from "../arknights/ArknightsTools.jsx";
import {
  check,
  Button,
  Row,
  PathControl,
  Section,
} from "./SettingsControls.jsx";

function GameSettings({ gameId, notify }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    let canceled = false;
    setData(null);
    setError("");
    window.api
      .gameGetSettings(gameId)
      .then((result) => {
        check(result);
        if (!canceled) setData(result);
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      });
    return () => {
      canceled = true;
    };
  }, [gameId, revision]);
  async function act(action, message) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      setRevision((value) => value + 1);
      notify("success", result.message || message || t("common.status.saved"));
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className="settings-state" role="alert">
        {error}
        <Button onClick={() => setRevision((value) => value + 1)}>
          {t("common.actions.reload")}
        </Button>
      </div>
    );
  if (!data)
    return (
      <div className="settings-state" role="status">
        <span className="spinner" />
        {t("settings.game.loading")}
      </div>
    );
  const game = data.game;
  const pathRow = (title, hint, value, action, extra) => (
    <Row title={title} hint={hint} path={true}>
      <PathControl
        label={title}
        value={value}
        disabled={busy}
        onSelect={action && (() => act(action))}
      >
        {extra}
      </PathControl>
    </Row>
  );
  return (
    <div className="system-game-detail" data-game-id={game.id} aria-busy={busy}>
      <Section
        id="game-paths"
        title={t("settings.game.pathAndLaunch")}
        actions={
          <Button
            small={true}
            disabled={busy}
            onClick={() => act(() => window.api.autoDetectPaths(game.id))}
          >
            {t("settings.game.detectPaths")}
          </Button>
        }
      >
        {pathRow(
          t("settings.game.modsFolder"),
          t("arknights.settings.libraryHint"),
          game.modFolderPath,
          () => window.api.selectModsFolder(game.id),
        )}
        {pathRow(
          t("settings.game.executable"),
          t("settings.game.executableHint", {
            executableHint:
              game.executableHint || t("settings.game.mainExecutable"),
          }),
          game.gamePath,
          () => window.api.selectGamePath(game.id),
        )}
        {pathRow(
          t("settings.game.officialLauncher"),
          t("settings.game.officialLauncherHint"),
          game.officialLauncherPath,
          () => window.api.selectOfficialLauncherPath(game.id),
        )}
      </Section>
      <ArknightsSettings notify={notify} gamePath={game.gamePath} />
    </div>
  );
}
export { GameSettings as GameSettingsPanel };
