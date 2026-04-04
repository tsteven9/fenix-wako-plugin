// =============================================================================
//  FENIX  |  Wako Plugin  |  v1.0.0
//  All code in one file: types, services, components, module.
//
//  Smart send logic:
//    Only Fen enabled      -> instant send to Fen
//    Only Fenlight enabled -> instant send to Fenlight
//    Both enabled          -> action sheet: pick Fen or Fenlight
//    Neither enabled       -> toast error
// =============================================================================

import { NgModule, Component, Input, OnInit, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IonicStorageModule } from '@ionic/storage-angular';
import { provideIonicAngular } from '@ionic/angular/standalone';
import {
  IonButton, IonIcon, IonSpinner,
  IonList, IonItem, IonLabel,
  IonToggle, IonNote,
  IonHeader, IonToolbar, IonTitle, IonContent,
  ActionSheetController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { playCircleOutline } from 'ionicons/icons';
import {
  PluginBaseModule, PluginBaseService, WakoProviders,
  WakoSettingsService, KodiAppService, KodiPlayerOpenPluginForm,
  WakoToastService, WakoGlobal,
  Movie, Show, Episode,
  ExplorerFile, ExplorerFolderItem,
  KodiOpenParams, OpenMedia, WakoFileActionButton,
  MovieDetailBaseComponent,
  EpisodeDetailBaseComponent,
  ShowDetailBaseComponent,
} from '@wako-app/mobile-sdk';
import { switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';

// =============================================================================
//  TYPES & CONSTANTS
// =============================================================================

export interface FenixSettings {
  fenEnabled:      boolean;
  fenlightEnabled: boolean;
  autoplay:        boolean;
}

const DEFAULTS: FenixSettings = {
  fenEnabled:      true,
  fenlightEnabled: true,
  autoplay:        true,
};

const STORAGE_KEY = 'plugin.fenix';

const ADDON_ID = {
  fen:      'plugin.video.fen',
  fenlight: 'plugin.video.fenlight',
} as const;

type AddonKey = keyof typeof ADDON_ID;

// =============================================================================
//  SETTINGS SERVICE
// =============================================================================

@Injectable({ providedIn: 'root' })
export class SettingsService {

  async get(): Promise<FenixSettings> {
    const stored = await WakoSettingsService.getByCategory<FenixSettings>(STORAGE_KEY);
    return { ...DEFAULTS, ...(stored ?? {}) };
  }

  async save(s: FenixSettings): Promise<void> {
    await WakoSettingsService.setByCategory(STORAGE_KEY, s);
  }

  async enabledAddons(): Promise<AddonKey[]> {
    const s    = await this.get();
    const list: AddonKey[] = [];
    if (s.fenEnabled)      list.push('fen');
    if (s.fenlightEnabled) list.push('fenlight');
    return list;
  }
}

// =============================================================================
//  FENIX SERVICE
// =============================================================================

@Injectable({ providedIn: 'root' })
export class FenixService {

  constructor(
    private cfg:   SettingsService,
    private toast: WakoToastService,
  ) {}

  async open(
    movie?:    Movie,
    show?:     Show,
    ep?:       Episode,
    addonKey?: AddonKey,
  ): Promise<void> {

    if (!addonKey) return;

    const settings = await this.cfg.get();
    const addonId  = ADDON_ID[addonKey];
    const ap       = settings.autoplay ? { autoplay: 'true' } : {};
    let   pluginUrl: string;

    if (ep && show) {
      const tmdb = show?.ids?.tmdb;
      if (!tmdb) { this.toast.presentToast('No TMDB ID for this show.', 3000, 'warning'); return; }
      pluginUrl = this.buildUrl(addonId, {
        action: 'open_media', media_type: 'episode',
        tmdb_id: String(tmdb), season: String(ep.seasonNumber), episode: String(ep.number), ...ap,
      });
    } else if (movie) {
      const tmdb = movie?.ids?.tmdb;
      if (!tmdb) { this.toast.presentToast('No TMDB ID for this movie.', 3000, 'warning'); return; }
      pluginUrl = this.buildUrl(addonId, {
        action: 'open_media', media_type: 'movie', tmdb_id: String(tmdb), ...ap,
      });
    } else if (show) {
      const tmdb = show?.ids?.tmdb;
      if (!tmdb) { this.toast.presentToast('No TMDB ID for this show.', 3000, 'warning'); return; }
      pluginUrl = this.buildUrl(addonId, {
        action: 'open_media', media_type: 'show', tmdb_id: String(tmdb),
      });
    } else { return; }

    this.sendToKodi(pluginUrl);
  }

  private buildUrl(addonId: string, params: Record<string, string>): string {
    return `plugin://${addonId}/?${new URLSearchParams(params).toString()}`;
  }

  private sendToKodi(pluginUrl: string): void {
    this.toast.presentToast('Sending to Kodi\u2026', 1500, 'primary');
    KodiAppService.checkAndConnectToCurrentHost().pipe(
      switchMap(connected => {
        if (!connected) {
          this.toast.presentToast('Could not reach Kodi. Is it running?', 3000, 'danger');
          return EMPTY;
        }
        return KodiPlayerOpenPluginForm.submit(pluginUrl);
      }),
    ).subscribe({
      next:  () => this.toast.presentToast('Sent to Kodi \u2713', 2000, 'success'),
      error: () => this.toast.presentToast('Error sending to Kodi.', 3000, 'danger'),
    });
  }
}

// =============================================================================
//  PLUGIN SERVICE
// =============================================================================

@Injectable()
export class PluginService extends PluginBaseService {

  constructor(private translate: TranslateService) { super(); }

  initialize():   any {}
  afterInstall(): any {}
  afterUpdate():  any {}

  setTranslation(lang: string, translations: any): any {
    this.translate.setDefaultLang(lang);
    this.translate.use(lang);
    this.translate.setTranslation(lang, translations);
  }

  customAction(_a: string, _d: any): any {}

  beforeMovieMiddleware(m: Movie)               { return Promise.resolve(m); }
  afterMovieMiddleware(m: Movie)                { return Promise.resolve(m); }
  beforeShowMiddleware(s: Show)                 { return Promise.resolve(s); }
  afterShowMiddleware(s: Show)                  { return Promise.resolve(s); }
  beforeEpisodeMiddleware(_s: Show, e: Episode) { return Promise.resolve(e); }
  afterEpisodeMiddleware(_s: Show, e: Episode)  { return Promise.resolve(e); }
  fetchExplorerFolderItem(): Promise<ExplorerFolderItem[]> { return Promise.resolve([]); }

  async getFileActionButtons(
    _f: ExplorerFile, _t?: string, _p?: string,
    _s?: number, _o?: OpenMedia, _k?: KodiOpenParams,
  ): Promise<WakoFileActionButton[]> { return []; }
}

// =============================================================================
//  SHARED BUTTON COMPONENT
// =============================================================================

@Component({
  selector: 'wk-fenix-btn',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon, IonSpinner],
  styles: [`
    ion-button   { --border-radius: 8px; margin: 6px 0; }
    .btn-content { display: flex; align-items: center; gap: 8px; }
  `],
  template: `
    <ion-button expand="block" fill="outline" color="primary"
      [disabled]="busy" (click)="handleTap()">
      <span class="btn-content">
        <ion-spinner *ngIf="busy"  name="crescent" style="width:18px;height:18px"></ion-spinner>
        <ion-icon   *ngIf="!busy" name="play-circle-outline"></ion-icon>
        <span>{{ label }}</span>
      </span>
    </ion-button>
  `,
})
export class FenixButtonComponent implements OnInit {

  @Input() movie?:   Movie;
  @Input() show?:    Show;
  @Input() episode?: Episode;

  label = 'Open on Kodi';
  busy  = false;

  constructor(
    private fenix: FenixService,
    private cfg:   SettingsService,
    private sheet: ActionSheetController,
    private toast: WakoToastService,
  ) { addIcons({ playCircleOutline }); }

  async ngOnInit(): Promise<void> {
    const enabled = await this.cfg.enabledAddons();
    if (enabled.length === 1) {
      this.label = enabled[0] === 'fenlight' ? 'Open with Fenlight' : 'Open with Fen';
    } else {
      this.label = 'Open on Kodi';
    }
  }

  async handleTap(): Promise<void> {
    const enabled = await this.cfg.enabledAddons();

    if (enabled.length === 0) {
      this.toast.presentToast('Enable at least one addon in Fenix settings.', 3000, 'warning');
      return;
    }

    if (enabled.length === 1) {
      await this.run(enabled[0]);
      return;
    }

    const as = await this.sheet.create({
      header: 'Open on Kodi with\u2026',
      buttons: [
        { text: '\u25B6\u2002Fen',      handler: () => this.run('fen') },
        { text: '\u25B6\u2002Fenlight', handler: () => this.run('fenlight') },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await as.present();
  }

  private async run(addon: AddonKey): Promise<void> {
    this.busy = true;
    try {
      await this.fenix.open(this.movie, this.show, this.episode, addon);
    } finally {
      this.busy = false;
    }
  }
}

// =============================================================================
//  ACTION COMPONENTS
// =============================================================================

@Component({ standalone: true, imports: [FenixButtonComponent],
  template: '<wk-fenix-btn [movie]="movie"></wk-fenix-btn>' })
export class MovieButtonComponent extends MovieDetailBaseComponent {
  movie!: Movie;
  setMovie(m: Movie): any { this.movie = m; }
}

@Component({ standalone: true, imports: [FenixButtonComponent],
  template: '<wk-fenix-btn [show]="show" [episode]="episode"></wk-fenix-btn>' })
export class EpisodeButtonComponent extends EpisodeDetailBaseComponent {
  show!: Show; episode!: Episode;
  setShowEpisode(s: Show, e: Episode): any { this.show = s; this.episode = e; }
}

@Component({ standalone: true, imports: [FenixButtonComponent],
  template: '<wk-fenix-btn [show]="show"></wk-fenix-btn>' })
export class ShowButtonComponent extends ShowDetailBaseComponent {
  show!: Show;
  setShow(s: Show): any { this.show = s; }
}

// =============================================================================
//  SETTINGS COMPONENT
// =============================================================================

@Component({
  selector: 'wk-fenix-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonLabel, IonToggle, IonNote,
  ],
  styles: ['ion-note { font-size: 12px; padding: 8px 16px 12px; display: block; }'],
  template: `
    <ion-header>
      <ion-toolbar><ion-title>Fenix Settings</ion-title></ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list *ngIf="cfg" lines="full">
        <ion-item>
          <ion-label><h2>Fen</h2><p>plugin.video.fen</p></ion-label>
          <ion-toggle [(ngModel)]="cfg!.fenEnabled"      (ngModelChange)="save()" slot="end"></ion-toggle>
        </ion-item>
        <ion-item>
          <ion-label><h2>Fenlight</h2><p>plugin.video.fenlight</p></ion-label>
          <ion-toggle [(ngModel)]="cfg!.fenlightEnabled" (ngModelChange)="save()" slot="end"></ion-toggle>
        </ion-item>
        <ion-note color="medium">
          One addon on = instant send. Both on = picker every tap.
        </ion-note>
        <ion-item>
          <ion-label>
            <h2>Autoplay</h2>
            <p>Skip the source picker and start playing immediately</p>
          </ion-label>
          <ion-toggle [(ngModel)]="cfg!.autoplay" (ngModelChange)="save()" slot="end"></ion-toggle>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
})
export class SettingsComponent implements OnInit {
  cfg: FenixSettings | null = null;
  constructor(private s: SettingsService) {}
  async ngOnInit(): Promise<void>  { this.cfg = await this.s.get(); }
  async save(): Promise<void> { if (this.cfg) await this.s.save(this.cfg); }
}

// =============================================================================
//  PLUGIN MODULE
// =============================================================================

@NgModule({
  imports: [
    TranslateModule.forRoot(),
    IonicStorageModule.forRoot({}),
    MovieButtonComponent,
    EpisodeButtonComponent,
    ShowButtonComponent,
    SettingsComponent,
  ],
  providers: [
    PluginService, FenixService, SettingsService,
    ...WakoProviders,
    provideIonicAngular({ swipeBackEnabled: true, backButtonText: '', mode: 'md' }),
  ],
})
export class PluginModule extends PluginBaseModule {
  static override pluginService     = PluginService;
  static override movieComponent    = MovieButtonComponent;
  static override episodeComponent  = EpisodeButtonComponent;
  static override showComponent     = ShowButtonComponent;
  static override settingsComponent = SettingsComponent;
}
