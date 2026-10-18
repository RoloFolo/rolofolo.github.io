import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/**
 * Signs an APK with a v2 signature (enough from Android 7.0, the minimum) and checks the result:
 * Sign <in.apk> <out.apk> <keystore> <alias> <password>
 */
public class Sign {
    public static void main(String[] args) throws Exception {
        char[] password = args[4].toCharArray();
        KeyStore store = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(args[2])) {
            store.load(in, password);
        }
        PrivateKey key = (PrivateKey) store.getKey(args[3], password);
        X509Certificate cert = (X509Certificate) store.getCertificate(args[3]);
        ApkSigner.SignerConfig signer =
                new ApkSigner.SignerConfig.Builder("STAPELGK", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(new File(args[0]))
                .setOutputApk(new File(args[1]))
                .setV1SigningEnabled(false) // the v1 signer in this apksig needs JDK internals that are gone
                .setV2SigningEnabled(true)
                .build()
                .sign();

        ApkVerifier.Result result = new ApkVerifier.Builder(new File(args[1])).build().verify();
        if (!result.isVerified()) {
            System.err.println("Verification failed: " + result.getErrors());
            System.exit(1);
        }
        System.out.println("Signed (v2 " + result.isVerifiedUsingV2Scheme() + ")");
    }
}
