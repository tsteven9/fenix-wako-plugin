import { CommonModule }                from '@angular/common';
import { Component, Input, NgModule,
         OnInit }                         from '@angular/core';
import { FormsModule }                    from '@angular/forms';
import { Injectable }                     from '@angular/core';
import {
  ActionSheetController,
  IonicModule,
  ToastController,
} from '@ionic/angular';
import {
  KodiAppService,
  KodiPlayerOpenPluginForm,
  Movie,
  Episode,
  Show,
  PluginBaseModule,
} from '@wako-app/mobile-sdk';
import { TranslateModule }                from '@ngx-translate/core';
import { EMPTY }                          from 'rxjs';
import { switchMap }                      from 'rxjs/operators';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AddonKey = 'fen' | 'fenlight';

export interface FenixSettings {
  fen:      boolean;
  fenlight: boolean;
  autoplay: boolean;
}

const DEFAULTS: FenixSettings = { fen: true, fenlight: false, autoplay: false };

const ADDON_ID: Record<AddonKey, string> = {
  fen:      'plugin.video.fen',
  fenlight: 'plugin.video.fenlight',
};

// ─── Settings Service ─────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private key = 'fenix_settings';

  async get(): Promise<FenixSettings> {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch { return { ...DEFAULTS }; }
  }

  async set(s: FenixSettings): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(s));
  }
}

// ─── Fenix Service ────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class FenixService {

  constructor(
    private cfg:         SettingsService,
    private toastCtrl:   ToastController,
    private actionSheet: ActionSheetController,
  ) {}

  async toast(message: string, duration = 2500): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration, position: 'bottom' });
    await t.present();
  }

  private buildUrl(addonId: string, params: Record<string, string>): string {
    return `plugin://${addonId}/?${new URLSearchParams(params).toString()}`;
  }

  private sendToKodi(pluginUrl: string): void {
    this.toast('Sending to Kodi…', 1500);
    KodiAppService.checkAndConnectToCurrentHost().pipe(
      switchMap(connected => {
        if (!connected) {
          this.toast('Could not reach Kodi. Is it running?', 3000);
          return EMPTY;
        }
        return KodiPlayerOpenPluginForm.submit(pluginUrl);
      }),
    ).subscribe({
      next:  () => this.toast('Sent to Kodi ✓', 2000),
      error: () => this.toast('Error sending to Kodi.', 3000),
    });
  }

  private async pickAddon(keys: AddonKey[]): Promise<AddonKey | null> {
    return new Promise(async resolve => {
      const sheet = await this.actionSheet.create({
        header: 'Open in…',
        buttons: [
          ...keys.map(k => ({
            text:    k === 'fen' ? 'Fen' : 'Fenlight',
            handler: () => resolve(k),
          })),
          { text: 'Cancel', role: 'cancel', handler: () => resolve(null) },
        ],
      });
      await sheet.present();
    });
  }

  async open(movie?: Movie, show?: Show, ep?: Episode): Promise<void> {
    const settings   = await this.cfg.get();
    const activeKeys = (Object.keys(ADDON_ID) as AddonKey[]).filter(k => settings[k]);

    if (activeKeys.length === 0) {
      await this.toast('Enable at least one addon in Fenix settings.');
      return;
    }

    const addonKey = activeKeys.length === 1
      ? activeKeys[0]
      : await this.pickAddon(activeKeys);

    if (!addonKey) return;

    const addonId = ADDON_ID[addonKey];
    const ap      = settings.autoplay ? { autoplay: 'true' } : {};
    let   url: string;

    if (ep && show) {
      const tmdb = show?.ids?.tmdb;
      if (!tmdb) { await this.toast('No TMDB ID for this show.'); return; }
      url = this.buildUrl(addonId, {
        action: 'open_media', media_type: 'episode',
        tmdb_id: String(tmdb), season: String(ep.seasonNumber),
        episode: String(ep.number), ...ap,
      });
    } else if (movie) {
      const tmdb = movie?.ids?.tmdb;
      if (!tmdb) { await this.toast('No TMDB ID for this movie.'); return; }
      url = this.buildUrl(addonId, {
        action: 'open_media', media_type: 'movie', tmdb_id: String(tmdb), ...ap,
      });
    } else if (show) {
      const tmdb = show?.ids?.tmdb;
      if (!tmdb) { await this.toast('No TMDB ID for this show.'); return; }
      url = this.buildUrl(addonId, {
        action: 'open_media', media_type: 'show', tmdb_id: String(tmdb),
      });
    } else { return; }

    this.sendToKodi(url);
  }
}

// ─── Settings Page ─────────────────────────────────────────────────────────────

@Component({
  standalone: false,
  selector: 'fenix-settings',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Fenix Settings</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-label>Fen</ion-label>
          <ion-toggle [(ngModel)]="settings.fen" (ionChange)="save()"></ion-toggle>
        </ion-item>
        <ion-item>
          <ion-label>Fenlight</ion-label>
          <ion-toggle [(ngModel)]="settings.fenlight" (ionChange)="save()"></ion-toggle>
        </ion-item>
        <ion-item>
          <ion-label>Autoplay</ion-label>
          <ion-toggle [(ngModel)]="settings.autoplay" (ionChange)="save()"></ion-toggle>
        </ion-item>
      </ion-list>
      <div class="ion-padding" style="color:var(--ion-color-medium);font-size:0.85rem">
        <p *ngIf="settings.fen && settings.fenlight">Both enabled — Fenix will ask which addon to use.</p>
        <p *ngIf="settings.fen && !settings.fenlight">Fen only — sends directly to Fen.</p>
        <p *ngIf="!settings.fen && settings.fenlight">Fenlight only — sends directly to Fenlight.</p>
        <p *ngIf="!settings.fen && !settings.fenlight" style="color:var(--ion-color-warning)">
          No addon enabled — please enable at least one.
        </p>
      </div>
    </ion-content>
  `,
})
export class SettingsPageComponent implements OnInit {
  settings: FenixSettings = { ...DEFAULTS };
  constructor(private cfg: SettingsService) {}
  async ngOnInit(): Promise<void> { this.settings = await this.cfg.get(); }
  async save(): Promise<void> { await this.cfg.set(this.settings); }
}

// ─── Movie Button ──────────────────────────────────────────────────────────────

@Component({
  standalone: false,
  selector: 'fenix-movie-button',
  template: `<ion-button fill="clear" (click)="open()">
    <ion-icon slot="icon-only" name="tv-outline"></ion-icon>
  </ion-button>`,
})
export class MovieButtonComponent {
  @Input() movie?: Movie;
  constructor(private fenix: FenixService) {}
  open(): void { this.fenix.open(this.movie); }
}

// ─── Episode Button ────────────────────────────────────────────────────────────

@Component({
  standalone: false,
  selector: 'fenix-episode-button',
  template: `<ion-button fill="clear" (click)="open()">
    <ion-icon slot="icon-only" name="tv-outline"></ion-icon>
  </ion-button>`,
})
export class EpisodeButtonComponent {
  @Input() show?:    Show;
  @Input() episode?: Episode;
  constructor(private fenix: FenixService) {}
  open(): void { this.fenix.open(undefined, this.show, this.episode); }
}

// ─── Show Button ───────────────────────────────────────────────────────────────

@Component({
  standalone: false,
  selector: 'fenix-show-button',
  template: `<ion-button fill="clear" (click)="open()">
    <ion-icon slot="icon-only" name="tv-outline"></ion-icon>
  </ion-button>`,
})
export class ShowButtonComponent {
  @Input() show?: Show;
  constructor(private fenix: FenixService) {}
  open(): void { this.fenix.open(undefined, this.show); }
}

// ─── Plugin Module ─────────────────────────────────────────────────────────────

@NgModule({
  declarations: [
    SettingsPageComponent,
    MovieButtonComponent,
    EpisodeButtonComponent,
    ShowButtonComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
  ],
  providers: [
    SettingsService,
    FenixService,
  ],
})
export class PluginModule extends PluginBaseModule {
  static getSettingsComponent() { return SettingsPageComponent; }
  static getMovieButtonComponent() { return MovieButtonComponent; }
  static getEpisodeButtonComponent() { return EpisodeButtonComponent; }
  static getShowButtonComponent() { return ShowButtonComponent; }
}
