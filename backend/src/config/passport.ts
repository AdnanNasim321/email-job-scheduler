
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "./prisma";
import { env } from "./env";

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      state: true,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        // Verify Google's email address
        const emailEntry = profile.emails?.find(
          (entry) => entry.verified === true
        );

        if (!emailEntry?.value) {
          return done(new Error("Google email is not verified"));
        }

        const email = emailEntry.value.toLowerCase();

        // Check whether this Google account already exists
        const existingGoogleUser = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });

        if (existingGoogleUser) {
          const user = await prisma.user.update({
            where: { id: existingGoogleUser.id },
            data: {
              name: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value,
            },
          });

          return done(null, user);
        }

        // Do not automatically link accounts using email alone
        const existingEmailUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingEmailUser) {
          return done(
            new Error(
              "An account with this email already exists. Separate account linking is required."
            )
          );
        }

        // Create a new user with verified Google email
        const user = await prisma.user.create({
          data: {
            googleId: profile.id,
            email,
            name: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
          },
        });

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

export default passport;
