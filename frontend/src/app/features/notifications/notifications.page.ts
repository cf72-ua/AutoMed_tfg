import { CommonModule } from "@angular/common";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import {
  AppNotification,
  NotificationType,
  NotificationsService,
} from "@core/services/notifications.service";

type NotificationFilter = "all" | "unread" | NotificationType;

@Component({
  selector: "app-notifications-page",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./notifications.page.html",
  styleUrls: ["./notifications.page.scss"],
})
export class NotificationsPage implements OnInit {
  readonly notificationsService = inject(NotificationsService);
  private router = inject(Router);

  activeFilter = signal<NotificationFilter>("all");

  notifications = computed(() => this.notificationsService.items());
  filteredNotifications = computed(() => {
    const filter = this.activeFilter();
    const items = this.notifications();

    if (filter === "unread") return items.filter((item) => !item.read);
    if (filter === "all") return items;
    return items.filter((item) => item.type === filter);
  });

  unreadCount = computed(() => this.notificationsService.unreadCount());

  ngOnInit(): void {
    this.notificationsService.refresh();
  }

  setFilter(filter: NotificationFilter): void {
    this.activeFilter.set(filter);
  }

  openNotification(notification: AppNotification): void {
    this.notificationsService.markAsRead(notification.id);
    this.router.navigate([notification.link]);
  }

  markAsRead(event: Event, notification: AppNotification): void {
    event.stopPropagation();
    this.notificationsService.markAsRead(notification.id);
  }

  markAllAsRead(): void {
    this.notificationsService.markAllAsRead();
  }

  refresh(): void {
    this.notificationsService.refresh();
  }

  trackById(_: number, notification: AppNotification): string {
    return notification.id;
  }
}
